import { StateSchema, MessagesValue } from "@langchain/langgraph";
import * as z from "zod";

export const AgentState = new StateSchema({
    messages: MessagesValue,
    question: z.string().describe('用户的问题'),
    intent: z.string().describe('记录用户意图'),
    context: z.string().describe('记录检索到的上下文'),
    output: z.string().describe('llm输出'),
});
