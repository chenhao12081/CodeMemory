import { StateSchema, MessagesValue } from "@langchain/langgraph";
import * as z from "zod";

export const AgentState = new StateSchema({
    messages: MessagesValue,
    question: z.string().describe('用户的问题'),
    intent: z.string().describe('记录用户意图'),
    context: z.string().describe('记录检索到的上下文'),
    retrievalStatus: z.enum(['sufficient', 'insufficient']).describe('检索证据是否足以回答问题'),
    retrievalReason: z.string().describe('检索证据判定原因'),
    answerMode: z.enum(['direct_chat', 'rag_answer', 'rag_fallback'])
        .describe('最终答案经过的分支'),
    output: z.string().describe('llm输出'),
});
