import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { runtimeOptions } from "../config/runtime.ts";
import pool from "../database/db.ts";
import {
    createAgent,
    runAgent,
} from "../graph/agent.ts";
import {
    E2E_BRANCHES,
    calculateE2EMetrics,
    parseE2EDataset,
    type E2EBranch,
    type E2EEvalCase,
    type E2EEvalResult,
} from "./e2e-core.ts";
import {
    ANSWER_JUDGE_SYSTEM_PROMPT,
    createAnswerJudgeModel,
    judgeAnswer,
} from "./e2e-judge.ts";

interface CorpusRow extends RowDataPacket {
    document_id: string;
    heading_text: string | null;
    content: string;
    metadata: unknown;
}

const datasetPath = resolve(
    runtimeOptions.positional.find((argument) => argument !== "--")
        || "src/data/e2e-eval.json",
);
const resultsDirectory = resolve(
    process.env.E2E_EVAL_RESULTS_DIR || "eval-results/e2e",
);

function positiveIntegerEnvironment(name: string): number | undefined {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return undefined;
    }
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} 必须是正整数，当前值：${rawValue}`);
    }
    return value;
}

const sampleLimit = positiveIntegerEnvironment("E2E_EVAL_LIMIT");
const judgeMaxAttempts = positiveIntegerEnvironment("E2E_JUDGE_MAX_ATTEMPTS") || 2;
const judgeModelName = process.env.E2E_JUDGE_MODEL?.trim()
    || runtimeOptions.chatModel;
const validateOnly = ["1", "true", "yes", "on"].includes(
    (process.env.E2E_EVAL_VALIDATE_ONLY || "").trim().toLowerCase(),
);

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}

function formatTimestamp(date: Date): string {
    return date.toISOString().replace(/[:.]/g, "-");
}

function metadataCorpusVersion(metadata: unknown): string | undefined {
    let value = metadata;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value);
        } catch {
            return undefined;
        }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }
    const corpusVersion = (value as Record<string, unknown>).corpus_version;
    return typeof corpusVersion === "string" ? corpusVersion : undefined;
}

async function loadAndValidateCorpus(
    corpusVersion: string,
    cases: readonly E2EEvalCase[],
) {
    const [rows] = await pool.query<CorpusRow[]>(`
        SELECT document_id, heading_text, content, metadata
        FROM document_chunks
    `);
    if (rows.length === 0) {
        throw new Error("MySQL document_chunks 为空，请先运行 pnpm corpus:rebuild");
    }

    const versions = new Set(
        rows.map((row) => metadataCorpusVersion(row.metadata))
            .filter((value): value is string => Boolean(value)),
    );
    if (versions.size !== 1) {
        throw new Error(
            `当前语料应只有一个 corpusVersion，实际为：`
            + `${[...versions].join("、") || "缺失"}`,
        );
    }
    const [currentCorpusVersion] = versions;
    if (currentCorpusVersion !== corpusVersion) {
        throw new Error(
            `E2E 数据集 corpusVersion 与当前语料不一致：`
            + `dataset=${corpusVersion}, corpus=${currentCorpusVersion}`,
        );
    }

    const rowsById = new Map(rows.map((row) => [row.document_id, row]));
    const relevantIds = new Set(cases.flatMap((testCase) => testCase.relevantChunkIds));
    const missingIds = [...relevantIds].filter((chunkId) => !rowsById.has(chunkId));
    if (missingIds.length > 0) {
        throw new Error(
            `E2E 数据集有 ${missingIds.length} 个 gold chunk 不在当前语料中：`
            + missingIds.slice(0, 5).join("、"),
        );
    }

    return {
        corpusVersion: currentCorpusVersion,
        chunkCount: rows.length,
        labeledChunkCount: relevantIds.size,
        rowsById,
    };
}

function buildGoldContext(
    testCase: E2EEvalCase,
    rowsById: ReadonlyMap<string, CorpusRow>,
): string {
    return testCase.relevantChunkIds.map((chunkId, index) => {
        const chunk = rowsById.get(chunkId)!;
        return [
            `[Gold ${index + 1}]`,
            `chunk_id: ${chunkId}`,
            chunk.heading_text ? `标题：${chunk.heading_text}` : null,
            `正文：${chunk.content}`,
        ].filter((line): line is string => line !== null).join("\n");
    }).join("\n\n");
}

function isBranch(value: unknown): value is E2EBranch {
    return typeof value === "string"
        && E2E_BRANCHES.includes(value as E2EBranch);
}

async function evaluateCase({
    agent,
    judgeModel,
    testCase,
    goldContext,
}: {
    agent: ReturnType<typeof createAgent>;
    judgeModel: ReturnType<typeof createAnswerJudgeModel>;
    testCase: E2EEvalCase;
    goldContext: string;
}): Promise<E2EEvalResult> {
    const agentStartedAt = performance.now();
    let run: Awaited<ReturnType<typeof runAgent>>;
    try {
        run = await runAgent(agent, testCase.question);
    } catch (error) {
        return {
            caseId: testCase.id,
            expectedBranch: testCase.expectedBranch,
            latencyMs: performance.now() - agentStartedAt,
            error: errorMessage(error),
        };
    }
    const latencyMs = performance.now() - agentStartedAt;
    if (!isBranch(run.state.answerMode)) {
        return {
            caseId: testCase.id,
            expectedBranch: testCase.expectedBranch,
            threadId: run.threadId,
            answer: run.output,
            latencyMs,
            error: `Agent 未返回合法 answerMode：${String(run.state.answerMode)}`,
        };
    }

    const result: E2EEvalResult = {
        caseId: testCase.id,
        expectedBranch: testCase.expectedBranch,
        actualBranch: run.state.answerMode,
        intent: run.state.intent,
        retrievalStatus: run.state.retrievalStatus,
        threadId: run.threadId,
        answer: run.output,
        actualContext: run.state.context || "",
        latencyMs,
    };
    const judgeStartedAt = performance.now();
    try {
        result.judge = await judgeAnswer({
            testCase,
            actualBranch: run.state.answerMode,
            answer: run.output,
            actualContext: run.state.context || "",
            goldContext,
        }, {
            model: judgeModel,
            maxAttempts: judgeMaxAttempts,
        });
    } catch (error) {
        result.judgeError = errorMessage(error);
    }
    result.judgeLatencyMs = performance.now() - judgeStartedAt;
    return result;
}

async function saveReport({
    startedAt,
    datasetSha256,
    corpus,
    cases,
    results,
    metrics,
}: {
    startedAt: Date;
    datasetSha256: string;
    corpus: {
        corpusVersion: string;
        chunkCount: number;
        labeledChunkCount: number;
    };
    cases: E2EEvalCase[];
    results: E2EEvalResult[];
    metrics: ReturnType<typeof calculateE2EMetrics>;
}) {
    const finishedAt = new Date();
    await mkdir(resultsDirectory, { recursive: true });
    const reportPath = resolve(
        resultsDirectory,
        `e2e-eval-${formatTimestamp(startedAt)}-${process.pid}.json`,
    );
    const report = {
        schemaVersion: 1,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        dataset: {
            path: datasetPath,
            sha256: datasetSha256,
            totalSamples: cases.length,
            sampleLimit: sampleLimit ?? null,
            cases,
        },
        corpus,
        models: {
            intent: runtimeOptions.model,
            answer: runtimeOptions.chatModel,
            judge: judgeModelName,
        },
        judgePolicy: {
            promptSha256: createHash("sha256")
                .update(ANSWER_JUDGE_SYSTEM_PROMPT)
                .digest("hex"),
            maxAttempts: judgeMaxAttempts,
        },
        metrics,
        results,
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return reportPath;
}

function printMetrics(metrics: ReturnType<typeof calculateE2EMetrics>) {
    console.log("\n总体指标");
    console.table([{
        samples: metrics.samples,
        agentErrors: metrics.agentErrors,
        judgeErrors: metrics.judgeErrors,
        branchAccuracy: formatPercent(metrics.branchAccuracy),
        intentAccuracy: formatPercent(metrics.intentAccuracy),
        evidenceAccuracy: formatPercent(metrics.evidenceDecisionAccuracy),
        judgePassRate: formatPercent(metrics.judgePassRate),
        strictE2E: formatPercent(metrics.strictE2ESuccessRate),
        "agentP50(ms)": metrics.latencyMs.p50.toFixed(2),
        "judgeP50(ms)": metrics.judgeLatencyMs.p50.toFixed(2),
    }]);

    console.log("\n按期望分支");
    console.table(metrics.byBranch.map((branchMetric) => {
        const judgeMetric = metrics.judgeByBranch.find(
            (item) => item.branch === branchMetric.branch,
        )!;
        return {
            branch: branchMetric.branch,
            samples: branchMetric.samples,
            precision: formatPercent(branchMetric.precision),
            recall: formatPercent(branchMetric.recall),
            f1: formatPercent(branchMetric.f1),
            judgePassRate: formatPercent(judgeMetric.passRate),
            correctness: judgeMetric.averageScores.correctness.toFixed(2),
            completeness: judgeMetric.averageScores.completeness.toFixed(2),
            relevance: judgeMetric.averageScores.relevance.toFixed(2),
            groundedness: judgeMetric.averageScores.groundedness?.toFixed(2) ?? "N/A",
            branchCompliance: judgeMetric.averageScores.branchCompliance.toFixed(2),
        };
    }));

    console.log("\n分支混淆矩阵（行=期望，列=实际）");
    console.table(E2E_BRANCHES.map((branch) => ({
        expected: branch,
        ...metrics.confusionMatrix[branch],
    })));
}

async function main() {
    const startedAt = new Date();
    let content: string;
    try {
        content = await readFile(datasetPath, "utf8");
    } catch {
        throw new Error(
            `找不到 E2E 评测集：${datasetPath}\n`
            + "请复制 src/data/e2e-eval.example.json 并完成分支及 gold chunk 标注。",
        );
    }
    const { dataset, sha256 } = parseE2EDataset(content);
    const selectedCases = sampleLimit
        ? dataset.cases.slice(0, sampleLimit)
        : dataset.cases;
    const corpus = await loadAndValidateCorpus(
        dataset.corpusVersion,
        selectedCases,
    );
    if (validateOnly) {
        console.log(`E2E 评测集：${datasetPath}`);
        console.log(`样例数：${selectedCases.length}/${dataset.cases.length}`);
        console.log(`语料版本：${corpus.corpusVersion}`);
        console.log(`gold chunk：${corpus.labeledChunkCount}`);
        console.log("E2E 数据与语料校验通过；validate-only 未调用 Agent 或 Answer Judge。");
        return;
    }
    const agent = createAgent();
    const judgeModel = createAnswerJudgeModel();
    const results: E2EEvalResult[] = [];
    const seenThreadIds = new Set<string>();

    console.log(`E2E 评测集：${datasetPath}`);
    console.log(`样例数：${selectedCases.length}/${dataset.cases.length}`);
    console.log(`Judge：${judgeModelName}`);
    for (const [index, testCase] of selectedCases.entries()) {
        process.stdout.write(`评测 ${index + 1}/${selectedCases.length} ${testCase.id}\r`);
        const result = await evaluateCase({
            agent,
            judgeModel,
            testCase,
            goldContext: buildGoldContext(testCase, corpus.rowsById),
        });
        if (result.threadId) {
            if (seenThreadIds.has(result.threadId)) {
                throw new Error(`检测到重复 thread_id：${result.threadId}`);
            }
            seenThreadIds.add(result.threadId);
        }
        results.push(result);
    }
    process.stdout.write("\n");

    const metrics = calculateE2EMetrics(selectedCases, results);
    const reportPath = await saveReport({
        startedAt,
        datasetSha256: sha256,
        corpus: {
            corpusVersion: corpus.corpusVersion,
            chunkCount: corpus.chunkCount,
            labeledChunkCount: corpus.labeledChunkCount,
        },
        cases: selectedCases,
        results,
        metrics,
    });
    printMetrics(metrics);
    console.log(`\n结果报告：${reportPath}`);

    const failures = results.filter((result) =>
        result.error
        || result.judgeError
        || result.actualBranch !== result.expectedBranch
        || !result.judge?.passed);
    if (failures.length > 0) {
        console.log("\n未通过样例");
        console.table(failures.map((result) => ({
            caseId: result.caseId,
            expected: result.expectedBranch,
            actual: result.actualBranch || "error",
            judgePassed: result.judge?.passed ?? false,
            reason: result.error || result.judgeError || result.judge?.reason || "",
        })));
    }
    if (metrics.agentErrors > 0 || metrics.judgeErrors > 0) {
        process.exitCode = 1;
    }
}

main().catch((error: unknown) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
}).finally(async () => {
    await pool.end();
});
