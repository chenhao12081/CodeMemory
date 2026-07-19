import "dotenv/config";
import { ChatDeepSeek } from "@langchain/deepseek";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import type { GraphNode, ConditionalEdgeRouter } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import { AgentState } from "../state/global.ts";
import { AIMessage } from "@langchain/core/messages";
import { classifyIntent } from "./intent.ts";
import { runtimeOptions } from "../config/runtime.ts";
import { retriveNode } from "./retrive.ts";

const chatModel = new ChatDeepSeek({
    model: runtimeOptions.chatModel,
})

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
    'retriveNode' | 'chatNode'
> = async (state) => {
    const lastMessage = state.messages.at(-1);
    if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
        return END;
    }
    if (lastMessage.content === 'need_rag') {
        return 'retriveNode';
    } else if (lastMessage.content === 'direct_chat') {
        return 'chatNode';
    }
    return END;
}

const agentBuilder = new StateGraph(AgentState)
    .addNode('chatNode', async (state) => {
        const response = await chatModel.invoke([
            ...state.messages,
            { role: 'user', content: `这是用户的问题：${state.question}，${state.intent === 'need_rag' ? `这是相关文档：${state.context}` : ''}` },
        ])
        return {
            messages: [response],
            output: String(response.content),
        }
    })
    .addNode('retriveNode', retriveNode)
    .addNode('routerNode', routerNode)
    .addEdge(START, 'routerNode')
    .addConditionalEdges('routerNode', shouldContinue, ['retriveNode', 'chatNode'])
    .addEdge('retriveNode', 'chatNode')
    .addEdge('chatNode', END)

const checkpointer = new MemorySaver();

const agent = agentBuilder.compile({
    checkpointer,
});

const config = {
    configurable: {
        thread_id: uuidv4(),
    }
}

const result = await agent.invoke({
    question: 'webpack-dev-server的作用是什么',
}, config);
console.log(result.output);
// export default agent;
