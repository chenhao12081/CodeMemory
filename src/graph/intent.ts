import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";
import * as z from "zod";
import { INTENTS, ROUTING_SYSTEM_PROMPT, type Intent } from "./intent-policy.ts";

export { INTENTS, type Intent } from "./intent-policy.ts";

const intentSchema = z.object({
    route: z.enum(INTENTS),
});

const model = new ChatOllama({
    model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5",
});

const structuredModel = model.withStructuredOutput(intentSchema);

export async function classifyIntent(question: string): Promise<Intent> {
    const result = await structuredModel.invoke([
        new SystemMessage(ROUTING_SYSTEM_PROMPT),
        new HumanMessage(`用户问题：${question}`),
    ]);

    return result.route;
}
