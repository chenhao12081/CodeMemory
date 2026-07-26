import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import pool from "../database/db.ts";
import { retrievalConfig } from "../retrieval/config.ts";
import { retrieveFromMultipleChannels } from "../retrieval/retrieval-service.ts";
import {
    RETRIEVAL_EVAL_STRATEGIES,
    calculateRetrievalMetrics,
    parseCutoffs,
    parseRetrievalDataset,
    type RetrievalEvalCase,
    type RetrievalEvalResult,
    type RetrievalEvalStrategy,
} from "./retrieval-core.ts";

interface CorpusChunkIdentityRow extends RowDataPacket {
    document_id: string;
    metadata: unknown;
}

type StrategyRun = {
    strategy: RetrievalEvalStrategy;
    retrievedChunkIds: string[];
    latencyMs: number;
    error?: string;
};

const positionalArguments = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const datasetPath = resolve(
    positionalArguments[0] || "src/data/retrieval-eval.json",
);
const resultsDirectory = resolve(
    process.env.RETRIEVAL_EVAL_RESULTS_DIR || "eval-results/retrieval",
);
const cutoffs = parseCutoffs(process.env.RETRIEVAL_EVAL_KS);
const warmupEnabled = !["0", "false", "no", "off"].includes(
    (process.env.RETRIEVAL_EVAL_WARMUP || "true").trim().toLowerCase(),
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

async function validateDatasetAgainstCorpus(
    expectedCorpusVersion: string,
    cases: readonly RetrievalEvalCase[],
) {
    const [rows] = await pool.query<CorpusChunkIdentityRow[]>(`
        SELECT document_id, metadata
        FROM document_chunks
    `);
    if (rows.length === 0) {
        throw new Error("MySQL document_chunks 为空，请先运行 pnpm corpus:rebuild");
    }

    const corpusVersions = new Set(
        rows.map((row) => metadataCorpusVersion(row.metadata))
            .filter((value): value is string => Boolean(value)),
    );
    if (corpusVersions.size !== 1) {
        throw new Error(
            `document_chunks 中应只有一个 corpusVersion，实际为：`
            + `${[...corpusVersions].join("、") || "缺失"}`,
        );
    }
    const [currentCorpusVersion] = corpusVersions;
    if (currentCorpusVersion !== expectedCorpusVersion) {
        throw new Error(
            `评测集 corpusVersion 与当前语料不一致：`
            + `dataset=${expectedCorpusVersion}, corpus=${currentCorpusVersion}`,
        );
    }

    const corpusChunkIds = new Set(rows.map((row) => row.document_id));
    const labeledChunkIds = new Set(cases.flatMap((testCase) => testCase.relevantChunkIds));
    const missingChunkIds = [...labeledChunkIds].filter((chunkId) => !corpusChunkIds.has(chunkId));
    if (missingChunkIds.length > 0) {
        throw new Error(
            `评测集有 ${missingChunkIds.length} 个相关 chunk ID 不在当前 MySQL 语料中：`
            + missingChunkIds.slice(0, 5).join("、"),
        );
    }

    return {
        corpusVersion: currentCorpusVersion,
        chunkCount: rows.length,
        labeledChunkCount: labeledChunkIds.size,
    };
}

function failedRuns(error: unknown): StrategyRun[] {
    return RETRIEVAL_EVAL_STRATEGIES.map((strategy) => ({
        strategy,
        retrievedChunkIds: [],
        latencyMs: 0,
        error: errorMessage(error),
    }));
}

async function evaluateCase(testCase: RetrievalEvalCase): Promise<StrategyRun[]> {
    let retrieval: Awaited<ReturnType<typeof retrieveFromMultipleChannels>>;
    try {
        retrieval = await retrieveFromMultipleChannels(testCase.question);
    } catch (error) {
        return failedRuns(error);
    }

    const denseError = retrieval.channelResults.dense.error;
    const channelErrors = Object.entries(retrieval.channelResults)
        .filter(([, result]) => result.error)
        .map(([channel, result]) => `${channel}: ${result.error}`);
    const multiChannelError = channelErrors.length > 0
        ? `三路召回不完整：${channelErrors.join("; ")}`
        : undefined;
    const rerankError = multiChannelError
        || (!retrieval.reranker.applied
            ? retrieval.reranker.error || "Cross-Encoder 重排未执行"
            : undefined);

    return [
        {
            strategy: "dense-only",
            retrievedChunkIds: retrieval.channelResults.dense.candidates
                .map((candidate) => candidate.documentId),
            latencyMs: retrieval.channelResults.dense.latencyMs,
            error: denseError,
        },
        {
            strategy: "three-way-rrf",
            retrievedChunkIds: retrieval.fusedCandidates
                .map((candidate) => candidate.documentId),
            latencyMs: retrieval.timings.recallMs + retrieval.timings.fusionMs,
            error: multiChannelError,
        },
        {
            strategy: "three-way-rrf-rerank",
            retrievedChunkIds: retrieval.rankedCandidates
                .map((candidate) => candidate.documentId),
            latencyMs: retrieval.timings.totalMs,
            error: rerankError,
        },
    ];
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
    corpus: Awaited<ReturnType<typeof validateDatasetAgainstCorpus>>;
    cases: RetrievalEvalCase[];
    results: RetrievalEvalResult[];
    metrics: ReturnType<typeof calculateRetrievalMetrics>;
}): Promise<string> {
    const finishedAt = new Date();
    await mkdir(resultsDirectory, { recursive: true });
    const reportPath = resolve(
        resultsDirectory,
        `retrieval-eval-${formatTimestamp(startedAt)}-${process.pid}.json`,
    );
    const report = {
        schemaVersion: 1,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        dataset: {
            path: datasetPath,
            sha256: datasetSha256,
            cases,
        },
        corpus,
        config: {
            cutoffs,
            denseTopK: retrievalConfig.denseTopK,
            sparseTopK: retrievalConfig.sparseTopK,
            headingTopK: retrievalConfig.headingTopK,
            fusionTopK: retrievalConfig.fusionTopK,
            rrfK: retrievalConfig.rrfK,
            weights: retrievalConfig.weights,
            rerankerTopK: retrievalConfig.rerankerTopK,
            rerankerModel: retrievalConfig.rerankerModel,
            rerankerRevision: retrievalConfig.rerankerRevision,
            warmupEnabled,
        },
        metrics,
        results,
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return reportPath;
}

function printMetrics(metrics: ReturnType<typeof calculateRetrievalMetrics>) {
    console.log("\n检索质量与耗时（失败样例按零分计入质量指标）");
    console.table(metrics.flatMap((strategyMetric) =>
        strategyMetric.atK.map((metric) => ({
            strategy: strategyMetric.strategy,
            k: metric.k,
            samples: strategyMetric.samples,
            errors: strategyMetric.errors,
            "HitRate@K": formatPercent(metric.hitRate),
            "Recall@K": formatPercent(metric.recall),
            "MRR@K": formatPercent(metric.mrr),
            "nDCG@K": formatPercent(metric.ndcg),
            "mean(ms)": strategyMetric.latencyMs.mean.toFixed(2),
            "p50(ms)": strategyMetric.latencyMs.p50.toFixed(2),
            "p95(ms)": strategyMetric.latencyMs.p95.toFixed(2),
        }))));
}

async function main() {
    const startedAt = new Date();
    let content: string;
    try {
        content = await readFile(datasetPath, "utf8");
    } catch {
        throw new Error(
            `找不到检索评测集：${datasetPath}\n`
            + "请复制 src/data/retrieval-eval.example.json 为 "
            + "src/data/retrieval-eval.json，并标注问题对应的稳定 chunk ID。",
        );
    }

    const { dataset, sha256 } = parseRetrievalDataset(content);
    const maxCutoff = Math.max(...cutoffs);
    const smallestResultLimit = Math.min(
        retrievalConfig.denseTopK,
        retrievalConfig.fusionTopK,
        retrievalConfig.rerankerTopK,
    );
    if (maxCutoff > smallestResultLimit) {
        throw new Error(
            `最大评测 cutoff=${maxCutoff} 超过三种策略共同支持的结果数 `
            + `${smallestResultLimit}，请调整 RETRIEVAL_EVAL_KS 或检索 TopK 配置`,
        );
    }
    if (!retrievalConfig.rerankerEnabled) {
        throw new Error("eval:retrieval 需要设置 RAG_RERANKER_ENABLED=true");
    }

    const corpus = await validateDatasetAgainstCorpus(
        dataset.corpusVersion,
        dataset.cases,
    );
    console.log(`评测集：${datasetPath}`);
    console.log(`语料版本：${corpus.corpusVersion}`);
    console.log(`样例数：${dataset.cases.length}，cutoff：${cutoffs.join(", ")}`);

    if (warmupEnabled) {
        console.log("预热检索与重排模型（结果不计入指标）...");
        await evaluateCase(dataset.cases[0]);
    }

    const results: RetrievalEvalResult[] = [];
    for (const [index, testCase] of dataset.cases.entries()) {
        process.stdout.write(`评测 ${index + 1}/${dataset.cases.length}\r`);
        const startedAtMs = performance.now();
        const runs = await evaluateCase(testCase);
        for (const run of runs) {
            results.push({
                caseId: testCase.id,
                strategy: run.strategy,
                retrievedChunkIds: run.retrievedChunkIds,
                latencyMs: run.latencyMs,
                error: run.error,
            });
        }
        // 防止某个异常分支返回不可信的负耗时，同时保留一次完整调用耗时供调试。
        const elapsedMs = performance.now() - startedAtMs;
        if (runs.every((run) => run.latencyMs === 0)) {
            for (const run of results.slice(-runs.length)) {
                run.latencyMs = elapsedMs;
            }
        }
    }
    process.stdout.write("\n");

    const metrics = calculateRetrievalMetrics(dataset.cases, results, cutoffs);
    const reportPath = await saveReport({
        startedAt,
        datasetSha256: sha256,
        corpus,
        cases: dataset.cases,
        results,
        metrics,
    });
    printMetrics(metrics);
    console.log(`\n结果报告：${reportPath}`);

    const errors = results.filter((result) => result.error);
    if (errors.length > 0) {
        console.log("\n失败样例");
        console.table(errors.map((result) => ({
            caseId: result.caseId,
            strategy: result.strategy,
            error: result.error,
        })));
        process.exitCode = 1;
    }
}

main().catch((error: unknown) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
}).finally(async () => {
    await pool.end();
});
