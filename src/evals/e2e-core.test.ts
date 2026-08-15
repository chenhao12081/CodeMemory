import assert from "node:assert/strict";
import test from "node:test";
import {
    calculateE2EMetrics,
    expectedEvidenceStatus,
    expectedIntent,
    parseE2EDataset,
    type E2EEvalCase,
    type E2EEvalResult,
} from "./e2e-core.ts";

const corpusVersion = `sha256:${"a".repeat(64)}`;
const chunkId = `sha256:${"1".repeat(64)}`;

test("解析三类 E2E 分支数据且 RAG 不强制完整参考答案", () => {
    const content = JSON.stringify({
        schemaVersion: 1,
        corpusVersion,
        cases: [
            {
                id: "rag",
                question: "RAG 问题",
                expectedBranch: "rag_answer",
                relevantChunkIds: [chunkId],
            },
            {
                id: "fallback",
                question: "库外知识",
                expectedBranch: "rag_fallback",
                requiredFacts: ["事实"],
            },
            {
                id: "chat",
                question: "改写文字",
                expectedBranch: "direct_chat",
                criteria: ["语气礼貌"],
            },
        ],
    });

    const { dataset, sha256 } = parseE2EDataset(content);

    assert.equal(dataset.cases.length, 3);
    assert.deepEqual(dataset.cases[0].requiredFacts, []);
    assert.match(sha256, /^[a-f0-9]{64}$/);
});

test("拒绝没有 gold chunk 的 RAG 样例", () => {
    assert.throws(
        () => parseE2EDataset(JSON.stringify({
            schemaVersion: 1,
            corpusVersion,
            cases: [{
                id: "rag",
                question: "问题",
                expectedBranch: "rag_answer",
            }],
        })),
        /必须标注 relevantChunkIds/,
    );
});

test("从期望分支派生 intent 和证据决策", () => {
    assert.equal(expectedIntent("direct_chat"), "direct_chat");
    assert.equal(expectedIntent("rag_answer"), "need_rag");
    assert.equal(expectedEvidenceStatus("rag_answer"), "sufficient");
    assert.equal(expectedEvidenceStatus("rag_fallback"), "insufficient");
    assert.equal(expectedEvidenceStatus("direct_chat"), undefined);
});

test("计算分支、Judge 和严格 E2E 指标", () => {
    const cases: E2EEvalCase[] = [
        {
            id: "rag",
            question: "RAG",
            expectedBranch: "rag_answer",
            relevantChunkIds: [chunkId],
            requiredFacts: [],
            forbiddenClaims: [],
            criteria: [],
        },
        {
            id: "fallback",
            question: "fallback",
            expectedBranch: "rag_fallback",
            relevantChunkIds: [],
            requiredFacts: ["事实"],
            forbiddenClaims: [],
            criteria: [],
        },
        {
            id: "chat",
            question: "chat",
            expectedBranch: "direct_chat",
            relevantChunkIds: [],
            requiredFacts: [],
            forbiddenClaims: [],
            criteria: ["简洁"],
        },
    ];
    const passedJudge = {
        passed: true,
        scores: {
            correctness: 5,
            completeness: 4,
            relevance: 5,
            groundedness: 5,
            branchCompliance: 5,
        },
        missingFacts: [],
        unsupportedClaims: [],
        reason: "通过",
    };
    const results: E2EEvalResult[] = [
        {
            caseId: "rag",
            expectedBranch: "rag_answer",
            actualBranch: "rag_answer",
            intent: "need_rag",
            retrievalStatus: "sufficient",
            latencyMs: 10,
            judge: passedJudge,
        },
        {
            caseId: "fallback",
            expectedBranch: "rag_fallback",
            actualBranch: "rag_answer",
            intent: "need_rag",
            retrievalStatus: "sufficient",
            latencyMs: 20,
            judge: { ...passedJudge, passed: false },
        },
        {
            caseId: "chat",
            expectedBranch: "direct_chat",
            latencyMs: 30,
            error: "timeout",
        },
    ];

    const metrics = calculateE2EMetrics(cases, results);

    assert.equal(metrics.branchAccuracy, 1 / 3);
    assert.equal(metrics.intentAccuracy, 2 / 3);
    assert.equal(metrics.evidenceDecisionAccuracy, 1 / 2);
    assert.equal(metrics.judgePassRate, 1 / 3);
    assert.equal(metrics.strictE2ESuccessRate, 1 / 3);
    assert.equal(metrics.agentErrors, 1);
    assert.equal(metrics.judgeErrors, 0);
    assert.equal(metrics.confusionMatrix.rag_fallback.rag_answer, 1);
    assert.equal(metrics.confusionMatrix.direct_chat.error, 1);
    assert.deepEqual(metrics.latencyMs, { mean: 15, p50: 10, p95: 20 });
    assert.deepEqual(metrics.judgeLatencyMs, { mean: 0, p50: 0, p95: 0 });
});
