import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { INTENTS, classifyIntent, type Intent } from "../graph/intent.ts";
import { ROUTING_SYSTEM_PROMPT } from "../graph/intent-policy.ts";

type EvalCase = {
    id?: string;
    question: string;
    expected: Intent;
};

type EvalResult = EvalCase & {
    actual: Intent | "error";
    error?: string;
};

type IntentMetric = {
    intent: Intent;
    samples: number;
    precision: number;
    recall: number;
    f1: number;
};

type ConfusionMatrix = Record<Intent, Record<Intent | "error", number>>;

type LoadedDataset = {
    cases: EvalCase[];
    sha256: string;
};

const datasetPath = resolve(process.argv[2] || "src/data/intent-eval.jsonl");
const resultsDirectory = resolve(process.env.INTENT_EVAL_RESULTS_DIR || "eval-results/intent");

function isIntent(value: unknown): value is Intent {
    return typeof value === "string" && INTENTS.includes(value as Intent);
}

async function loadCases(path: string): Promise<LoadedDataset> {
    let content: string;
    try {
        content = await readFile(path, "utf8");
    } catch {
        throw new Error(
            `找不到样例集：${path}\n` +
            '请创建该文件，每行一个 JSON，例如：{"question":"什么是 RAG？","expected":"need_rag"}',
        );
    }

    const cases: EvalCase[] = [];
    for (const [index, line] of content.split(/\r?\n/).entries()) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("#")) {
            continue;
        }

        let value: unknown;
        try {
            value = JSON.parse(trimmedLine);
        } catch {
            throw new Error(`第 ${index + 1} 行不是合法 JSON。`);
        }

        if (!value || typeof value !== "object") {
            throw new Error(
                `第 ${index + 1} 行格式错误，需要 question 字符串及 expected（${INTENTS.join(" 或 ")}）。`,
            );
        }

        const candidate = value as Record<string, unknown>;
        if (
            typeof candidate.question !== "string" ||
            !candidate.question.trim() ||
            !isIntent(candidate.expected) ||
            (candidate.id !== undefined && typeof candidate.id !== "string")
        ) {
            throw new Error(
                `第 ${index + 1} 行格式错误，需要 question 字符串及 expected（${INTENTS.join(" 或 ")}）。`,
            );
        }

        cases.push({
            id: candidate.id,
            question: candidate.question.trim(),
            expected: candidate.expected,
        });
    }

    if (!cases.length) {
        throw new Error("样例集为空，请至少添加一条样例。");
    }

    return {
        cases,
        sha256: createHash("sha256").update(content).digest("hex"),
    };
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}

function calculateMetrics(results: EvalResult[]) {
    const total = results.length;
    // 准确率的分子：模型预测意图与人工标注完全一致的样例数。
    const correct = results.filter((result) => result.actual === result.expected).length;
    // 调用失败没有有效预测，按错误路由处理，不能从指标分母中排除。
    const errors = results.filter((result) => result.actual === "error").length;
    const byIntent = INTENTS.map((intent) => {
        // 将当前 intent 视为“正类”，另一个意图和 error 都视为“非当前类”。
        // TP：期望和预测都是当前 intent；FP：预测为当前 intent，但期望不是。
        const truePositive = results.filter(
            (result) => result.expected === intent && result.actual === intent,
        ).length;
        const falsePositive = results.filter(
            (result) => result.expected !== intent && result.actual === intent,
        ).length;
        // FN：期望为当前 intent，但预测成另一个意图或模型调用失败。
        const falseNegative = results.filter(
            (result) => result.expected === intent && result.actual !== intent,
        ).length;
        // Precision = TP / (TP + FP)，回答“预测为该意图时有多准”。
        const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0;
        // Recall = TP / (TP + FN)，回答“该意图的样例被找回了多少”。
        const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0;
        // F1 = 2 * Precision * Recall / (Precision + Recall)，平衡精确率和召回率。
        const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

        return {
            intent,
            samples: results.filter((result) => result.expected === intent).length,
            precision,
            recall,
            f1,
        } satisfies IntentMetric;
    });

    return {
        total,
        correct,
        errors,
        // Accuracy = 正确预测数 / 全部样例数。
        accuracy: correct / total,
        // Macro F1 是两个意图 F1 的算术平均，不按样例数加权，避免多数类掩盖少数类问题。
        macroF1: byIntent.reduce((sum, metric) => sum + metric.f1, 0) / byIntent.length,
        missingIntents: byIntent.filter((metric) => metric.samples === 0).map((metric) => metric.intent),
        byIntent,
    };
}

function buildConfusionMatrix(results: EvalResult[]): ConfusionMatrix {
    // error 单列保留调用失败，便于区分模型误判和基础设施问题。
    const predictions = [...INTENTS, "error"] as const;
    // 行是人工期望意图，列是模型实际预测；每个单元格累计对应组合的样例数。
    const matrix = Object.fromEntries(
        INTENTS.map((expected) => [
            expected,
            Object.fromEntries(predictions.map((actual) => [actual, 0])),
        ]),
    ) as Record<Intent, Record<(typeof predictions)[number], number>>;

    for (const result of results) {
        matrix[result.expected][result.actual] += 1;
    }

    return matrix;
}

function printConfusionMatrix(matrix: ConfusionMatrix) {
    console.log("\n混淆矩阵（行 = 期望意图，列 = 模型预测）");
    console.table(
        INTENTS.map((expected) => ({
            expected,
            ...matrix[expected],
        })),
    );
}

function formatTimestamp(date: Date): string {
    return date.toISOString().replace(/[:.]/g, "-");
}

async function saveReport({
    startedAt,
    finishedAt,
    datasetSha256,
    metrics,
    confusionMatrix,
    results,
}: {
    startedAt: Date;
    finishedAt: Date;
    datasetSha256: string;
    metrics: ReturnType<typeof calculateMetrics>;
    confusionMatrix: ConfusionMatrix;
    results: EvalResult[];
}): Promise<string> {
    await mkdir(resultsDirectory, { recursive: true });
    const reportPath = resolve(
        resultsDirectory,
        `intent-eval-${formatTimestamp(startedAt)}-${process.pid}.json`,
    );
    const report = {
        schemaVersion: 1,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        model: {
            provider: "ollama",
            name: process.env.OLLAMA_CHAT_MODEL || "qwen2.5",
        },
        routingPolicy: {
            sha256: createHash("sha256").update(ROUTING_SYSTEM_PROMPT).digest("hex"),
            prompt: ROUTING_SYSTEM_PROMPT,
        },
        dataset: {
            path: datasetPath,
            sha256: datasetSha256,
            samples: results.length,
        },
        metrics,
        confusionMatrix,
        results,
    };

    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return reportPath;
}

async function main() {
    const startedAt = new Date();
    const { cases, sha256 } = await loadCases(datasetPath);
    const results: EvalResult[] = [];

    for (const [index, testCase] of cases.entries()) {
        process.stdout.write(`评测 ${index + 1}/${cases.length}\r`);
        try {
            results.push({
                ...testCase,
                actual: await classifyIntent(testCase.question),
            });
        } catch (error) {
            results.push({
                ...testCase,
                actual: "error",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    process.stdout.write("\n");

    const metrics = calculateMetrics(results);
    const confusionMatrix = buildConfusionMatrix(results);
    const reportPath = await saveReport({
        startedAt,
        finishedAt: new Date(),
        datasetSha256: sha256,
        metrics,
        confusionMatrix,
        results,
    });
    console.log(`样例集：${datasetPath}`);
    console.log(`总样本：${metrics.total}`);
    console.log(`准确率：${formatPercent(metrics.accuracy)} (${metrics.correct}/${metrics.total})`);
    console.log(`宏平均 F1：${formatPercent(metrics.macroF1)}`);
    console.log(`模型调用异常：${metrics.errors}`);
    console.log(`结果报告：${reportPath}`);
    console.log("\n按意图统计");
    console.table(
        metrics.byIntent.map((metric) => ({
            intent: metric.intent,
            samples: metric.samples,
            precision: formatPercent(metric.precision),
            recall: formatPercent(metric.recall),
            f1: formatPercent(metric.f1),
        })),
    );
    if (metrics.missingIntents.length) {
        console.warn(`提示：样例集中缺少 ${metrics.missingIntents.join("、")}，宏平均 F1 不具参考性。`);
    }
    printConfusionMatrix(confusionMatrix);

    // 误判样例包含意图不一致和模型调用失败，方便回看问题并补充提示词或样例。
    const failures = results.filter((result) => result.actual !== result.expected);
    if (failures.length) {
        console.log("\n误判或调用失败样例");
        console.table(
            failures.map((result) => ({
                id: result.id || "",
                question: result.question,
                expected: result.expected,
                actual: result.actual,
                error: result.error || "",
            })),
        );
    }

    if (metrics.errors === metrics.total) {
        console.error("所有模型调用均失败，请确认 Ollama 服务已启动且 OLLAMA_CHAT_MODEL 可用。");
        process.exitCode = 1;
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
