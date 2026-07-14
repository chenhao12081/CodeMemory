import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { ROUTING_SYSTEM_PROMPT, type Intent } from "../graph/intent-policy.ts";

type Seed = { topic: string; intent: Intent };
type Message = { role: "system" | "user" | "assistant"; content: string };
type DatasetRow = {
    id: string;
    topic: string;
    question: string;
    expected: Intent;
    messages: Message[];
};

const ragSeeds: Seed[] = [
    { topic: "Transformer 架构", intent: "need_rag" },
    { topic: "自注意力机制", intent: "need_rag" },
    { topic: "大语言模型架构和发展", intent: "need_rag" },
    { topic: "提示词工程", intent: "need_rag" },
    { topic: "零样本和少样本提示", intent: "need_rag" },
    { topic: "链式思考与思维树", intent: "need_rag" },
    { topic: "指令微调", intent: "need_rag" },
    { topic: "大模型评估与基准测试", intent: "need_rag" },
    { topic: "PEFT 和 LoRA", intent: "need_rag" },
    { topic: "RLHF 和后学习", intent: "need_rag" },
    { topic: "Node.js 流和 pipeline", intent: "need_rag" },
    { topic: "SSE 流式输出", intent: "need_rag" },
    { topic: "Vercel AI SDK", intent: "need_rag" },
    { topic: "Ollama 本地部署", intent: "need_rag" },
    { topic: "streamText 结果转换", intent: "need_rag" },
    { topic: "Zod 结构化输出和 generateObject", intent: "need_rag" },
    { topic: "AI Chat", intent: "need_rag" },
    { topic: "Markdown、Excel 和 Word 文档读取", intent: "need_rag" },
    { topic: "RAG 检索增强生成", intent: "need_rag" },
    { topic: "文档切片和 LangChain 切片工具", intent: "need_rag" },
    { topic: "Embedding 与 bge-m3", intent: "need_rag" },
    { topic: "Pinecone 向量数据库", intent: "need_rag" },
    { topic: "Agent 工作流", intent: "need_rag" },
    { topic: "智能体评估和设计模式", intent: "need_rag" },
    { topic: "工具调用和 JSON Schema", intent: "need_rag" },
    { topic: "ReAct、MCP 和知识图谱", intent: "need_rag" },
    { topic: "流程编排与架构", intent: "need_rag" },
    { topic: "LangChain 消息和模型调用", intent: "need_rag" },
    { topic: "LangChain 工具、Agent、上下文和中间件", intent: "need_rag" },
    { topic: "LangGraph 图工作流和编排模式", intent: "need_rag" },
    { topic: "LangGraph 路由和持久化", intent: "need_rag" },
    { topic: "LangGraph 流式输出和时间旅行", intent: "need_rag" },
    { topic: "LangGraph 中断和恢复", intent: "need_rag" },
    { topic: "LangGraph Memory", intent: "need_rag" },
    { topic: "LangGraph Subgraph", intent: "need_rag" },
];

const directSeeds: Seed[] = [
    { topic: "React 前端框架", intent: "direct_chat" },
    { topic: "Vue 前端框架", intent: "direct_chat" },
    { topic: "Webpack 和 Vite", intent: "direct_chat" },
    { topic: "CSS 布局", intent: "direct_chat" },
    { topic: "Next.js 和 Angular", intent: "direct_chat" },
    { topic: "Java 和 Spring Boot", intent: "direct_chat" },
    { topic: "Go、Rust 和 C 语言", intent: "direct_chat" },
    { topic: "MySQL、Redis 和 PostgreSQL", intent: "direct_chat" },
    { topic: "Docker 和 Kubernetes", intent: "direct_chat" },
    { topic: "Python 和 Django", intent: "direct_chat" },
    { topic: "计算机视觉和 CNN", intent: "direct_chat" },
    { topic: "XGBoost 和推荐系统", intent: "direct_chat" },
    { topic: "TensorFlow 和 PyTorch", intent: "direct_chat" },
    { topic: "Stable Diffusion", intent: "direct_chat" },
    { topic: "Elasticsearch、Kafka 和 Nginx", intent: "direct_chat" },
    { topic: "Git 和 Linux", intent: "direct_chat" },
    { topic: "AWS 云部署", intent: "direct_chat" },
    { topic: "Flutter、Swift 和 Android", intent: "direct_chat" },
    { topic: "日常生活和创作", intent: "direct_chat" },
    { topic: "天气、体育和实时信息", intent: "direct_chat" },
    { topic: "旅行行程规划", intent: "direct_chat" },
    { topic: "烹饪", intent: "direct_chat" },
    { topic: "翻译", intent: "direct_chat" },
    { topic: "股票和加密货币实时行情", intent: "direct_chat" },
    { topic: "数学计算", intent: "direct_chat" },
    { topic: "C# 和 .NET", intent: "direct_chat" },
    { topic: "PHP 和 Laravel", intent: "direct_chat" },
    { topic: "Bash Shell 脚本", intent: "direct_chat" },
    { topic: "GraphQL API", intent: "direct_chat" },
    { topic: "TCP/IP 网络协议", intent: "direct_chat" },
    { topic: "GitHub Actions CI/CD", intent: "direct_chat" },
    { topic: "Jest 和 Cypress 测试", intent: "direct_chat" },
    { topic: "Unity 游戏开发", intent: "direct_chat" },
    { topic: "Figma 界面设计", intent: "direct_chat" },
    { topic: "D3.js 数据可视化", intent: "direct_chat" },
];

const trainTemplates = [
    "请介绍一下{topic}。",
    "我想系统了解{topic}，先讲讲核心概念。",
    "用通俗的话解释{topic}。",
    "{topic}主要解决什么问题？",
    "为什么项目中会用到{topic}？",
    "{topic}的基本工作原理是什么？",
    "如何从零开始学习{topic}？",
    "能给我一个{topic}的实践思路吗？",
    "{topic}通常有哪些关键组成部分？",
    "如何判断一个方案是否用到了{topic}？",
    "我遇到了{topic}相关问题，该从哪里排查？",
    "请说明{topic}和相近概念的区别。",
    "在后端项目中怎样落地{topic}？",
    "如果要优化{topic}，通常先看哪些地方？",
    "请给出一个关于{topic}的简单例子。",
    "{topic}适合什么场景，不适合什么场景？",
    "我刚接触这个方向，应该怎样理解{topic}？",
    "使用{topic}时有哪些常见坑？",
    "请从工程实践角度讲讲{topic}。",
    "如何把{topic}接入一个实际应用？",
];

const validationTemplates = [
    "我对{topic}有点疑惑，可以先解释它是什么吗？",
    "如果我要在项目里使用{topic}，第一步应该做什么？",
    "{topic}和另一个类似方案相比有什么特点？",
    "请帮我分析一下{topic}的使用边界。",
    "能否结合一个实际场景说明{topic}？",
];

function makeRow(prefix: "train" | "validation", index: number, seed: Seed, question: string): DatasetRow {
    return {
        id: `${prefix}-${String(index).padStart(4, "0")}`,
        topic: seed.topic,
        question,
        expected: seed.intent,
        messages: [
            { role: "system", content: ROUTING_SYSTEM_PROMPT },
            { role: "user", content: question },
            { role: "assistant", content: JSON.stringify({ route: seed.intent }) },
        ],
    };
}

function render(rows: DatasetRow[]): string {
    return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function buildRows(prefix: "train" | "validation"): DatasetRow[] {
    const templates = prefix === "train" ? trainTemplates : validationTemplates;
    const rows: DatasetRow[] = [];
    const countPerClass = ragSeeds.length * templates.length;

    if (ragSeeds.length !== directSeeds.length) {
        throw new Error("正例和负例主题数量必须一致，才能保持每个主题的训练次数相同。");
    }

    for (let index = 0; index < countPerClass; index += 1) {
        const templateIndex = Math.floor(index / ragSeeds.length);
        const ragSeed = ragSeeds[index % ragSeeds.length];
        const directSeed = directSeeds[index % directSeeds.length];
        const template = templates[templateIndex % templates.length];

        rows.push(
            makeRow(
                prefix,
                rows.length + 1,
                ragSeed,
                template.replace("{topic}", ragSeed.topic),
            ),
        );
        rows.push(
            makeRow(
                prefix,
                rows.length + 1,
                directSeed,
                template.replace("{topic}", directSeed.topic),
            ),
        );
    }

    return rows;
}

const dataDirectory = fileURLToPath(new URL(".", import.meta.url));
const trainRows = buildRows("train");
const validationRows = buildRows("validation");

await writeFile(`${dataDirectory}intent-train.jsonl`, render(trainRows), "utf8");
await writeFile(`${dataDirectory}intent-validation.jsonl`, render(validationRows), "utf8");

console.log(`generated ${trainRows.length} training rows`);
console.log(`generated ${validationRows.length} validation rows`);
