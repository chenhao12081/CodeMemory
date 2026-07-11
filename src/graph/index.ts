import "dotenv/config";
import { ChatOllama } from "@langchain/ollama";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import type { GraphNode, ConditionalEdgeRouter } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import ollama from "ollama";
import { index } from "../verctor/index.ts";
import { AgentState } from "../state/global.ts";
import pool from "../database/db.ts";
import type { DocumentChunkRow } from "../tools/database.ts";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { classifyIntent } from "./intent.ts";

const model = new ChatOllama({
    model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5",
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

const retriveNode: GraphNode<typeof AgentState> = async (state) => {
    const intentEmbedding = await ollama.embed({
        model: 'bge-m3',
        input: state.question,
    });
    const searchResults = await index.query({
        vector: intentEmbedding.embeddings[0], // 拿着问题的向量去数据库里比对
        topK: 3,                // 只返回最相似的 1 条结果
        includeMetadata: true   // 🚨 必须设为 true，不然它只把 1024 个数字还给你，你根本不知道原文是什么
    });
    const topMatch = searchResults.matches[0];
    let documentDetail = null;
    try {
        const sql = `
          SELECT * FROM document_chunks 
          WHERE chunk_index = ?
        `;
        
        // 传入泛型 <DocumentChunkRow[]>，确保 rows 有类型提示
        const [rows] = await pool.query<DocumentChunkRow[]>(sql, [topMatch?.metadata?.chunk_index]);
    
        // 如果查到了，返回第一条；如果没查到，返回 null
        [documentDetail] = rows;
        console.log('@查到相关数据了', documentDetail);
    } catch (error) {
        console.error('查询切片数据失败:', error);
        throw error;
    }
    return {
        context: documentDetail?.content,
    };
};

const agentBuilder = new StateGraph(AgentState)
    .addNode('chatNode', async (state) => {
        const response = await model.invoke([
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
