import { createHash } from "node:crypto";

export const RETRIEVAL_EVAL_STRATEGIES = [
    "dense-only",
    "three-way-rrf",
    "three-way-rrf-rerank",
] as const;

export type RetrievalEvalStrategy = (typeof RETRIEVAL_EVAL_STRATEGIES)[number];

export type RetrievalEvalCase = {
    id: string;
    question: string;
    relevantChunkIds: string[];
};

export type RetrievalEvalDataset = {
    schemaVersion: 1;
    corpusVersion: string;
    cases: RetrievalEvalCase[];
};

export type RetrievalEvalResult = {
    caseId: string;
    strategy: RetrievalEvalStrategy;
    retrievedChunkIds: string[];
    latencyMs: number;
    error?: string;
};

export type RetrievalMetricsAtK = {
    k: number;
    hitRate: number;
    recall: number;
    mrr: number;
    ndcg: number;
};

export type RetrievalStrategyMetrics = {
    strategy: RetrievalEvalStrategy;
    samples: number;
    successfulSamples: number;
    errors: number;
    atK: RetrievalMetricsAtK[];
    latencyMs: {
        mean: number;
        p50: number;
        p95: number;
    };
};

export type LoadedRetrievalDataset = {
    dataset: RetrievalEvalDataset;
    sha256: string;
};

const STABLE_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertStableId(value: unknown, field: string): asserts value is string {
    if (typeof value !== "string" || !STABLE_ID_PATTERN.test(value)) {
        throw new Error(`${field} 必须是 sha256:<64 位小写十六进制> 稳定 ID`);
    }
}

export function parseRetrievalDataset(content: string): LoadedRetrievalDataset {
    let value: unknown;
    try {
        value = JSON.parse(content);
    } catch {
        throw new Error("检索评测集不是合法 JSON");
    }

    if (!isRecord(value)) {
        throw new Error("检索评测集根节点必须是 JSON 对象");
    }
    if (value.schemaVersion !== 1) {
        throw new Error(`仅支持 schemaVersion=1，当前值：${String(value.schemaVersion)}`);
    }
    assertStableId(value.corpusVersion, "corpusVersion");
    if (!Array.isArray(value.cases) || value.cases.length === 0) {
        throw new Error("cases 必须是非空数组");
    }

    const seenCaseIds = new Set<string>();
    const cases = value.cases.map((item, index): RetrievalEvalCase => {
        const field = `cases[${index}]`;
        if (!isRecord(item)) {
            throw new Error(`${field} 必须是对象`);
        }
        if (typeof item.id !== "string" || !item.id.trim()) {
            throw new Error(`${field}.id 必须是非空字符串`);
        }
        const id = item.id.trim();
        if (seenCaseIds.has(id)) {
            throw new Error(`评测样例 id 重复：${id}`);
        }
        seenCaseIds.add(id);

        if (typeof item.question !== "string" || !item.question.trim()) {
            throw new Error(`${field}.question 必须是非空字符串`);
        }
        if (!Array.isArray(item.relevantChunkIds) || item.relevantChunkIds.length === 0) {
            throw new Error(`${field}.relevantChunkIds 必须是非空数组`);
        }

        const relevantChunkIds = item.relevantChunkIds.map((chunkId, chunkIndex) => {
            assertStableId(chunkId, `${field}.relevantChunkIds[${chunkIndex}]`);
            return chunkId;
        });
        if (new Set(relevantChunkIds).size !== relevantChunkIds.length) {
            throw new Error(`${field}.relevantChunkIds 不能包含重复 ID`);
        }

        return {
            id,
            question: item.question.trim(),
            relevantChunkIds,
        };
    });

    return {
        dataset: {
            schemaVersion: 1,
            corpusVersion: value.corpusVersion,
            cases,
        },
        sha256: createHash("sha256").update(content).digest("hex"),
    };
}

function uniqueRanking(documentIds: readonly string[]): string[] {
    return [...new Set(documentIds)];
}

function discountedCumulativeGain(relevance: readonly number[]): number {
    return relevance.reduce(
        (sum, value, index) => sum + value / Math.log2(index + 2),
        0,
    );
}

function metricsAtK(
    relevantChunkIds: readonly string[],
    retrievedChunkIds: readonly string[],
    k: number,
): Omit<RetrievalMetricsAtK, "k"> {
    const relevant = new Set(relevantChunkIds);
    const ranking = uniqueRanking(retrievedChunkIds).slice(0, k);
    const binaryRelevance = ranking.map((chunkId) => relevant.has(chunkId) ? 1 : 0);
    const hitCount = binaryRelevance.reduce<number>((sum, value) => sum + value, 0);
    const firstRelevantRank = binaryRelevance.findIndex((value) => value === 1);
    const idealRelevance = Array.from(
        { length: Math.min(relevant.size, k) },
        () => 1,
    );
    const idealDcg = discountedCumulativeGain(idealRelevance);

    return {
        hitRate: hitCount > 0 ? 1 : 0,
        recall: hitCount / relevant.size,
        mrr: firstRelevantRank >= 0 ? 1 / (firstRelevantRank + 1) : 0,
        ndcg: idealDcg > 0
            ? discountedCumulativeGain(binaryRelevance) / idealDcg
            : 0,
    };
}

function percentile(values: readonly number[], percentileValue: number): number {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const rank = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
    return sorted[rank];
}

export function calculateRetrievalMetrics(
    cases: readonly RetrievalEvalCase[],
    results: readonly RetrievalEvalResult[],
    cutoffs: readonly number[],
): RetrievalStrategyMetrics[] {
    const casesById = new Map(cases.map((testCase) => [testCase.id, testCase]));

    return RETRIEVAL_EVAL_STRATEGIES.map((strategy) => {
        const strategyResults = results.filter((result) => result.strategy === strategy);
        const resultsByCaseId = new Map(
            strategyResults.map((result) => [result.caseId, result]),
        );
        const errors = cases.filter((testCase) => {
            const result = resultsByCaseId.get(testCase.id);
            return !result || Boolean(result.error);
        }).length;
        const successfulLatencies = strategyResults
            .filter((result) => !result.error)
            .map((result) => result.latencyMs);
        const atK = cutoffs.map((k): RetrievalMetricsAtK => {
            const perCase = cases.map((testCase) => {
                const result = resultsByCaseId.get(testCase.id);
                return metricsAtK(
                    testCase.relevantChunkIds,
                    result?.error ? [] : result?.retrievedChunkIds ?? [],
                    k,
                );
            });

            return {
                k,
                hitRate: perCase.reduce((sum, metric) => sum + metric.hitRate, 0) / cases.length,
                recall: perCase.reduce((sum, metric) => sum + metric.recall, 0) / cases.length,
                mrr: perCase.reduce((sum, metric) => sum + metric.mrr, 0) / cases.length,
                ndcg: perCase.reduce((sum, metric) => sum + metric.ndcg, 0) / cases.length,
            };
        });

        // 额外结果或未知 case ID 会掩盖评测器接线错误，应立即拒绝。
        for (const result of strategyResults) {
            if (!casesById.has(result.caseId)) {
                throw new Error(`评测结果包含未知 caseId：${result.caseId}`);
            }
        }

        return {
            strategy,
            samples: cases.length,
            successfulSamples: cases.length - errors,
            errors,
            atK,
            latencyMs: {
                mean: successfulLatencies.length
                    ? successfulLatencies.reduce((sum, value) => sum + value, 0)
                        / successfulLatencies.length
                    : 0,
                p50: percentile(successfulLatencies, 0.5),
                p95: percentile(successfulLatencies, 0.95),
            },
        };
    });
}

export function parseCutoffs(rawValue: string | undefined): number[] {
    const values = (rawValue || "1,3,5,10")
        .split(",")
        .map((value) => Number(value.trim()));
    if (
        values.length === 0
        || values.some((value) => !Number.isInteger(value) || value <= 0)
    ) {
        throw new Error(
            `RETRIEVAL_EVAL_KS 必须是逗号分隔的正整数，当前值：${rawValue}`,
        );
    }
    return [...new Set(values)].sort((left, right) => left - right);
}
