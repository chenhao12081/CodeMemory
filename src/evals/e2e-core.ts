import { createHash } from "node:crypto";

export const E2E_BRANCHES = [
    "direct_chat",
    "rag_answer",
    "rag_fallback",
] as const;

export type E2EBranch = (typeof E2E_BRANCHES)[number];
export type E2EIntent = "direct_chat" | "need_rag";
export type E2EEvidenceStatus = "sufficient" | "insufficient";

export type E2EEvalCase = {
    id: string;
    question: string;
    expectedBranch: E2EBranch;
    relevantChunkIds: string[];
    requiredFacts: string[];
    forbiddenClaims: string[];
    criteria: string[];
};

export type E2EEvalDataset = {
    schemaVersion: 1;
    corpusVersion: string;
    cases: E2EEvalCase[];
};

export type AnswerJudgeScores = {
    correctness: number;
    completeness: number;
    relevance: number;
    groundedness: number | null;
    branchCompliance: number;
};

export type AnswerJudgeResult = {
    passed: boolean;
    scores: AnswerJudgeScores;
    missingFacts: string[];
    unsupportedClaims: string[];
    reason: string;
};

export type E2EEvalResult = {
    caseId: string;
    expectedBranch: E2EBranch;
    actualBranch?: E2EBranch;
    intent?: string;
    retrievalStatus?: string;
    threadId?: string;
    answer?: string;
    actualContext?: string;
    latencyMs: number;
    judgeLatencyMs?: number;
    error?: string;
    judge?: AnswerJudgeResult;
    judgeError?: string;
};

export type BranchMetric = {
    branch: E2EBranch;
    samples: number;
    precision: number;
    recall: number;
    f1: number;
};

export type BranchConfusionMatrix = Record<
    E2EBranch,
    Record<E2EBranch | "error", number>
>;

const STABLE_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBranch(value: unknown): value is E2EBranch {
    return typeof value === "string"
        && E2E_BRANCHES.includes(value as E2EBranch);
}

function parseStringArray(
    value: unknown,
    field: string,
    {
        stableIds = false,
    }: {
        stableIds?: boolean;
    } = {},
): string[] {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new Error(`${field} 必须是字符串数组`);
    }
    const parsed = value.map((item, index) => {
        if (typeof item !== "string" || !item.trim()) {
            throw new Error(`${field}[${index}] 必须是非空字符串`);
        }
        const normalized = item.trim();
        if (stableIds && !STABLE_ID_PATTERN.test(normalized)) {
            throw new Error(
                `${field}[${index}] 必须是 sha256:<64 位小写十六进制> 稳定 ID`,
            );
        }
        return normalized;
    });
    if (new Set(parsed).size !== parsed.length) {
        throw new Error(`${field} 不能包含重复值`);
    }
    return parsed;
}

export function parseE2EDataset(content: string) {
    let value: unknown;
    try {
        value = JSON.parse(content);
    } catch {
        throw new Error("E2E 评测集不是合法 JSON");
    }
    if (!isRecord(value)) {
        throw new Error("E2E 评测集根节点必须是对象");
    }
    if (value.schemaVersion !== 1) {
        throw new Error(`仅支持 schemaVersion=1，当前值：${String(value.schemaVersion)}`);
    }
    if (
        typeof value.corpusVersion !== "string"
        || !STABLE_ID_PATTERN.test(value.corpusVersion)
    ) {
        throw new Error("corpusVersion 必须是稳定的 sha256:* 版本");
    }
    if (!Array.isArray(value.cases) || value.cases.length === 0) {
        throw new Error("cases 必须是非空数组");
    }

    const seenIds = new Set<string>();
    const cases = value.cases.map((item, index): E2EEvalCase => {
        const field = `cases[${index}]`;
        if (!isRecord(item)) {
            throw new Error(`${field} 必须是对象`);
        }
        if (typeof item.id !== "string" || !item.id.trim()) {
            throw new Error(`${field}.id 必须是非空字符串`);
        }
        const id = item.id.trim();
        if (seenIds.has(id)) {
            throw new Error(`E2E 样例 id 重复：${id}`);
        }
        seenIds.add(id);
        if (typeof item.question !== "string" || !item.question.trim()) {
            throw new Error(`${field}.question 必须是非空字符串`);
        }
        if (!isBranch(item.expectedBranch)) {
            throw new Error(
                `${field}.expectedBranch 必须是 ${E2E_BRANCHES.join("、")} 之一`,
            );
        }

        const relevantChunkIds = parseStringArray(
            item.relevantChunkIds,
            `${field}.relevantChunkIds`,
            { stableIds: true },
        );
        const requiredFacts = parseStringArray(
            item.requiredFacts,
            `${field}.requiredFacts`,
        );
        const forbiddenClaims = parseStringArray(
            item.forbiddenClaims,
            `${field}.forbiddenClaims`,
        );
        const criteria = parseStringArray(item.criteria, `${field}.criteria`);

        if (item.expectedBranch === "rag_answer" && relevantChunkIds.length === 0) {
            throw new Error(`${field} 为 rag_answer 时必须标注 relevantChunkIds`);
        }
        if (
            item.expectedBranch !== "rag_answer"
            && requiredFacts.length === 0
            && criteria.length === 0
        ) {
            throw new Error(
                `${field} 为 ${item.expectedBranch} 时至少需要 requiredFacts 或 criteria`,
            );
        }

        return {
            id,
            question: item.question.trim(),
            expectedBranch: item.expectedBranch,
            relevantChunkIds,
            requiredFacts,
            forbiddenClaims,
            criteria,
        };
    });

    return {
        dataset: {
            schemaVersion: 1,
            corpusVersion: value.corpusVersion,
            cases,
        } satisfies E2EEvalDataset,
        sha256: createHash("sha256").update(content).digest("hex"),
    };
}

export function expectedIntent(branch: E2EBranch): E2EIntent {
    return branch === "direct_chat" ? "direct_chat" : "need_rag";
}

export function expectedEvidenceStatus(
    branch: E2EBranch,
): E2EEvidenceStatus | undefined {
    if (branch === "rag_answer") {
        return "sufficient";
    }
    if (branch === "rag_fallback") {
        return "insufficient";
    }
    return undefined;
}

function safeRatio(numerator: number, denominator: number): number {
    return denominator > 0 ? numerator / denominator : 0;
}

function percentile(values: readonly number[], percentileValue: number): number {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const rank = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
    return sorted[rank];
}

export function calculateE2EMetrics(
    cases: readonly E2EEvalCase[],
    results: readonly E2EEvalResult[],
) {
    const resultByCaseId = new Map<string, E2EEvalResult>();
    for (const result of results) {
        if (resultByCaseId.has(result.caseId)) {
            throw new Error(`E2E 结果 caseId 重复：${result.caseId}`);
        }
        resultByCaseId.set(result.caseId, result);
    }
    for (const result of results) {
        if (!cases.some((testCase) => testCase.id === result.caseId)) {
            throw new Error(`E2E 结果包含未知 caseId：${result.caseId}`);
        }
    }

    const confusionMatrix = Object.fromEntries(
        E2E_BRANCHES.map((expectedBranch) => [
            expectedBranch,
            Object.fromEntries(
                [...E2E_BRANCHES, "error"].map((actualBranch) => [actualBranch, 0]),
            ),
        ]),
    ) as BranchConfusionMatrix;

    let branchCorrect = 0;
    let intentCorrect = 0;
    let evidenceCorrect = 0;
    let evidenceSamples = 0;
    let judgePassed = 0;
    let judgeErrors = 0;
    let strictSuccess = 0;

    for (const testCase of cases) {
        const result = resultByCaseId.get(testCase.id);
        const actualBranch = result?.error || !result?.actualBranch
            ? "error"
            : result.actualBranch;
        confusionMatrix[testCase.expectedBranch][actualBranch] += 1;

        const isBranchCorrect = actualBranch === testCase.expectedBranch;
        if (isBranchCorrect) {
            branchCorrect += 1;
        }
        if (!result?.error && result?.intent === expectedIntent(testCase.expectedBranch)) {
            intentCorrect += 1;
        }

        const expectedEvidence = expectedEvidenceStatus(testCase.expectedBranch);
        if (expectedEvidence) {
            evidenceSamples += 1;
            if (!result?.error && result?.retrievalStatus === expectedEvidence) {
                evidenceCorrect += 1;
            }
        }

        if (result?.judge?.passed) {
            judgePassed += 1;
        }
        if (result && !result.error && !result.judge) {
            judgeErrors += 1;
        }
        if (isBranchCorrect && result?.judge?.passed) {
            strictSuccess += 1;
        }
    }

    const byBranch = E2E_BRANCHES.map((branch): BranchMetric => {
        const truePositive = confusionMatrix[branch][branch];
        const falsePositive = E2E_BRANCHES
            .filter((expectedBranch) => expectedBranch !== branch)
            .reduce(
                (sum, expectedBranch) => sum + confusionMatrix[expectedBranch][branch],
                0,
            );
        const falseNegative = Object.entries(confusionMatrix[branch])
            .filter(([actualBranch]) => actualBranch !== branch)
            .reduce((sum, [, count]) => sum + count, 0);
        const precision = safeRatio(truePositive, truePositive + falsePositive);
        const recall = safeRatio(truePositive, truePositive + falseNegative);

        return {
            branch,
            samples: cases.filter((testCase) => testCase.expectedBranch === branch).length,
            precision,
            recall,
            f1: precision + recall
                ? (2 * precision * recall) / (precision + recall)
                : 0,
        };
    });

    const successfulLatencies = results
        .filter((result) => !result.error)
        .map((result) => result.latencyMs);
    const judgeLatencies = results
        .map((result) => result.judgeLatencyMs)
        .filter((latency): latency is number => latency !== undefined);
    const judgeByBranch = E2E_BRANCHES.map((branch) => {
        const branchCases = cases.filter((testCase) => testCase.expectedBranch === branch);
        const branchResults = branchCases
            .map((testCase) => resultByCaseId.get(testCase.id))
            .filter((result): result is E2EEvalResult => Boolean(result));
        const judged = branchResults.filter((result) => result.judge);
        const scoreNames = [
            "correctness",
            "completeness",
            "relevance",
            "branchCompliance",
        ] as const;
        const averageScores = Object.fromEntries(
            scoreNames.map((scoreName) => [
                scoreName,
                judged.length
                    ? judged.reduce(
                        (sum, result) => sum + result.judge!.scores[scoreName],
                        0,
                    ) / judged.length
                    : 0,
            ]),
        ) as Record<(typeof scoreNames)[number], number>;
        const groundedScores = judged
            .map((result) => result.judge!.scores.groundedness)
            .filter((score): score is number => score !== null);

        return {
            branch,
            samples: branchCases.length,
            judged: judged.length,
            passRate: safeRatio(
                judged.filter((result) => result.judge?.passed).length,
                branchCases.length,
            ),
            averageScores: {
                ...averageScores,
                groundedness: groundedScores.length
                    ? groundedScores.reduce((sum, score) => sum + score, 0)
                        / groundedScores.length
                    : null,
            },
        };
    });

    return {
        samples: cases.length,
        agentErrors: cases.filter((testCase) =>
            Boolean(resultByCaseId.get(testCase.id)?.error)
            || !resultByCaseId.has(testCase.id)).length,
        branchAccuracy: safeRatio(branchCorrect, cases.length),
        intentAccuracy: safeRatio(intentCorrect, cases.length),
        evidenceDecisionAccuracy: safeRatio(evidenceCorrect, evidenceSamples),
        evidenceSamples,
        judgePassRate: safeRatio(judgePassed, cases.length),
        judgeErrors,
        strictE2ESuccessRate: safeRatio(strictSuccess, cases.length),
        byBranch,
        judgeByBranch,
        confusionMatrix,
        latencyMs: {
            mean: successfulLatencies.length
                ? successfulLatencies.reduce((sum, value) => sum + value, 0)
                    / successfulLatencies.length
                : 0,
            p50: percentile(successfulLatencies, 0.5),
            p95: percentile(successfulLatencies, 0.95),
        },
        judgeLatencyMs: {
            mean: judgeLatencies.length
                ? judgeLatencies.reduce((sum, value) => sum + value, 0)
                    / judgeLatencies.length
                : 0,
            p50: percentile(judgeLatencies, 0.5),
            p95: percentile(judgeLatencies, 0.95),
        },
    };
}
