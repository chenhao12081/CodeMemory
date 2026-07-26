import assert from "node:assert/strict";
import test from "node:test";
import {
    calculateRetrievalMetrics,
    parseCutoffs,
    parseRetrievalDataset,
    type RetrievalEvalCase,
    type RetrievalEvalResult,
} from "./retrieval-core.ts";

const corpusVersion = `sha256:${"a".repeat(64)}`;
const chunkA = `sha256:${"1".repeat(64)}`;
const chunkB = `sha256:${"2".repeat(64)}`;
const chunkC = `sha256:${"3".repeat(64)}`;

test("解析带 corpusVersion 和稳定 chunk ID 的检索评测集", () => {
    const content = JSON.stringify({
        schemaVersion: 1,
        corpusVersion,
        cases: [{
            id: "q1",
            question: "  什么是 RAG？ ",
            relevantChunkIds: [chunkA, chunkB],
        }],
    });

    const result = parseRetrievalDataset(content);

    assert.equal(result.dataset.corpusVersion, corpusVersion);
    assert.equal(result.dataset.cases[0].question, "什么是 RAG？");
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test("拒绝旧式或重复的 chunk ID 标注", () => {
    assert.throws(
        () => parseRetrievalDataset(JSON.stringify({
            schemaVersion: 1,
            corpusVersion,
            cases: [{
                id: "q1",
                question: "问题",
                relevantChunkIds: ["doc-1"],
            }],
        })),
        /稳定 ID/,
    );
    assert.throws(
        () => parseRetrievalDataset(JSON.stringify({
            schemaVersion: 1,
            corpusVersion,
            cases: [{
                id: "q1",
                question: "问题",
                relevantChunkIds: [chunkA, chunkA],
            }],
        })),
        /不能包含重复 ID/,
    );
});

test("计算 HitRate、Recall、MRR、nDCG 并将失败计为零分", () => {
    const cases: RetrievalEvalCase[] = [
        {
            id: "q1",
            question: "问题一",
            relevantChunkIds: [chunkA, chunkB],
        },
        {
            id: "q2",
            question: "问题二",
            relevantChunkIds: [chunkC],
        },
    ];
    const results: RetrievalEvalResult[] = [
        {
            caseId: "q1",
            strategy: "dense-only",
            retrievedChunkIds: [chunkB, chunkB, "irrelevant", chunkA],
            latencyMs: 10,
        },
        {
            caseId: "q2",
            strategy: "dense-only",
            retrievedChunkIds: [],
            latencyMs: 20,
            error: "timeout",
        },
    ];

    const dense = calculateRetrievalMetrics(cases, results, [1, 3])[0];

    assert.deepEqual(dense.latencyMs, { mean: 10, p50: 10, p95: 10 });
    assert.equal(dense.errors, 1);
    assert.deepEqual(dense.atK[0], {
        k: 1,
        hitRate: 0.5,
        recall: 0.25,
        mrr: 0.5,
        ndcg: 0.5,
    });
    assert.equal(dense.atK[1].hitRate, 0.5);
    assert.equal(dense.atK[1].recall, 0.5);
    assert.equal(dense.atK[1].mrr, 0.5);
    assert.ok(dense.atK[1].ndcg > 0.45 && dense.atK[1].ndcg < 0.47);
});

test("解析并去重排序 cutoff", () => {
    assert.deepEqual(parseCutoffs("10, 3,3,1"), [1, 3, 10]);
    assert.throws(() => parseCutoffs("1,0"), /正整数/);
});
