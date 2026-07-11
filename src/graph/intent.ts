import { HumanMessage } from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";
import * as z from "zod";

export const INTENTS = ["need_rag", "direct_chat"] as const;
export type Intent = (typeof INTENTS)[number];

const intentSchema = z.object({
    route: z.enum(INTENTS),
});

const model = new ChatOllama({
    model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5",
});

const structuredModel = model.withStructuredOutput(intentSchema);

const routingPrompt = `
    你是一个智能路由中枢。你需要根据用户的输入，决定下一步的操作路径。
    你背后的向量数据库中仅包含以下领域的文档：
    1. AI 应用与后端流处理

    判定规则：
    - 如果用户的提问属于上述范畴，请输出 "need_rag"
    - 如果用户问的是其他问题、或者纯闲聊，请输出 "direct_chat"

    注意：你不需要知道问题的具体答案，你只需要判断【用户问的方向】是否值得去查库。
`;

export async function classifyIntent(question: string): Promise<Intent> {
    const result = await structuredModel.invoke([
        new HumanMessage(routingPrompt),
        new HumanMessage(`用户问题：${question}`),
    ]);

    return result.route;
}
