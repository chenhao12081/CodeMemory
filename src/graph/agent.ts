import "dotenv/config";
import { ChatDeepSeek } from "@langchain/deepseek";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import type { GraphNode, ConditionalEdgeRouter } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import { AgentState } from "../state/global.ts";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { classifyIntent } from "./intent.ts";
import { runtimeOptions } from "../config/runtime.ts";
import { retriveNode } from "./retrive.ts";
import * as z from "zod";

const chatModel = new ChatDeepSeek({
    model: runtimeOptions.chatModel,
})

const evidenceSchema = z.object({
    sufficient: z.boolean(),
    reason: z.string(),
});

const evidenceJudgeModel = new ChatDeepSeek({
    model: runtimeOptions.chatModel,
    temperature: 0,
});

function parseEvidenceResult(content: string): z.infer<typeof evidenceSchema> {
    const normalized = content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
    const json = normalized.match(/\{[\s\S]*\}/)?.[0];

    if (!json) {
        throw new Error(`证据审核模型未返回 JSON：${content}`);
    }

    return evidenceSchema.parse(JSON.parse(json));
}

const routerNode: GraphNode<typeof AgentState> = async (state) => {
    const intent = await classifyIntent(state.question);
    return {
        messages: [new AIMessage(intent)],
        intent,
    };
}

const shouldContinue: ConditionalEdgeRouter<
    typeof AgentState,
    Record<string, unknown>,
    'retriveNode' | 'generalChatNode'
> = async (state) => {
    const lastMessage = state.messages.at(-1);
    if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
        return END;
    }
    if (lastMessage.content === 'need_rag') {
        return 'retriveNode';
    } else if (lastMessage.content === 'direct_chat') {
        return 'generalChatNode';
    }
    return END;
}

const checkEvidenceNode: GraphNode<typeof AgentState> = async (state) => {
    if (!state.context.trim()) {
        return {
            retrievalStatus: 'insufficient',
            retrievalReason: '没有检索到可用的知识库片段',
        };
    }

    const response = await evidenceJudgeModel.invoke([
        new SystemMessage(`你是 RAG 检索证据审核器。
你的任务是判断检索资料是否足以回答用户问题，而不是回答问题。
只返回 JSON，不要输出解释或 Markdown。格式为：{"sufficient":true,"reason":"判定原因"}。

判定规则：
1. 资料必须包含回答问题所需的核心事实或步骤。
2. 资料只是主题相近、提到相关名词，不代表证据充分。
3. 不允许使用模型自身知识补全资料缺失的事实。
4. 如果只能回答问题的一小部分，应判定为不充分。`),
        new HumanMessage(`用户问题：
${state.question}

检索资料：
${state.context}`),
    ]);
    const result = parseEvidenceResult(String(response.content));

    const retrievalStatus = result.sufficient ? 'sufficient' : 'insufficient';
    console.log(`检索证据判定：${retrievalStatus}，原因：${result.reason}`);
    return {
        retrievalStatus,
        retrievalReason: result.reason,
    };
};

const routeAfterEvidence: ConditionalEdgeRouter<
    typeof AgentState,
    Record<string, unknown>,
    'ragAnswerNode' | 'generalChatNode'
> = async (state) => {
    return state.retrievalStatus === 'sufficient'
        ? 'ragAnswerNode'
        : 'generalChatNode';
};

const ragAnswerNode: GraphNode<typeof AgentState> = async (state) => {
    const response = await chatModel.invoke([
        new SystemMessage(`你是 CodeMemory 知识库助手。
只能依据提供的检索资料回答，不能使用资料之外的知识补充事实。
请综合多段资料给出清晰答案。
如果资料实际不足以支持答案，请明确说明知识库资料不足，不要猜测。`),
        new HumanMessage(`用户问题：
${state.question}

检索资料：
${state.context}`),
    ]);

    return {
        messages: [response],
        output: String(response.content),
    };
};

const generalChatNode: GraphNode<typeof AgentState> = async (state) => {
    const isRagFallback = state.intent === 'need_rag';
    const response = await chatModel.invoke([
        new SystemMessage(isRagFallback
            ? `知识库证据不足，请使用你的通用知识回答用户问题。
不得声称答案来自知识库；不确定的内容必须明确说明。`
            : `你是一个通用聊天助手，请直接回答用户问题；不确定的内容必须明确说明。`),
        new HumanMessage(state.question),
    ]);

    const content = String(response.content);
    const output = isRagFallback
        ? `知识库中没有找到足够资料，以下基于 DeepSeek 通用知识回答：\n\n${content}`
        : content;

    return {
        messages: [new AIMessage(output)],
        output,
    };
};

function buildAgentGraph() {
    return new StateGraph(AgentState)
        .addNode('generalChatNode', generalChatNode)
        .addNode('ragAnswerNode', ragAnswerNode)
        .addNode('checkEvidenceNode', checkEvidenceNode)
        .addNode('retriveNode', retriveNode)
        .addNode('routerNode', routerNode)
        .addEdge(START, 'routerNode')
        .addConditionalEdges('routerNode', shouldContinue, ['retriveNode', 'generalChatNode'])
        .addEdge('retriveNode', 'checkEvidenceNode')
        .addConditionalEdges('checkEvidenceNode', routeAfterEvidence, ['ragAnswerNode', 'generalChatNode'])
        .addEdge('ragAnswerNode', END)
        .addEdge('generalChatNode', END);
}

/**
 * 创建一个带独立 MemorySaver 的 CodeMemory Agent。
 *
 * 同一个 agent 可以供一批评测样例复用；每次调用应通过 runAgent 使用独立 thread_id。
 */
export function createAgent() {
    return buildAgentGraph().compile({
        checkpointer: new MemorySaver(),
    });
}

export type CodeMemoryAgent = ReturnType<typeof createAgent>;

export type RunAgentOptions = {
    /**
     * 默认自动生成。仅在确实需要延续同一段会话状态时显式复用。
     */
    threadId?: string;
};

export async function runAgent(
    agent: CodeMemoryAgent,
    question: string,
    options: RunAgentOptions = {},
) {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) {
        throw new Error("question 不能为空");
    }
    if (options.threadId !== undefined && !options.threadId.trim()) {
        throw new Error("threadId 不能为空字符串");
    }

    const threadId = options.threadId?.trim() || uuidv4();
    const state = await agent.invoke(
        { question: normalizedQuestion },
        {
            configurable: {
                thread_id: threadId,
            },
        },
    );

    return {
        threadId,
        output: state.output,
        state,
    };
}
