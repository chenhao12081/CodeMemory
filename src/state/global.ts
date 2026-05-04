import { StateSchema, MessagesValue } from "@langchain/langgraph";
import * as z from "zod";

export const AgentState = new StateSchema({
    messages: MessagesValue,
    intent: z.string().describe('记录用户意图'),
    context: z.string().describe('记录检索到的上下文'),
});
