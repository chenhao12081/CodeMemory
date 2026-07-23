import assert from "node:assert/strict";
import test from "node:test";
import { weightedReciprocalRankFusion } from "./fusion.ts";
import type { RetrievalCandidate } from "./types.ts";

const weights = {
    dense: 0.45,
    sparse: 0.35,
    heading: 0.20,
};

function candidate(
    documentId: string,
    channel: RetrievalCandidate["channel"],
    rank: number,
): RetrievalCandidate {
    return { documentId, channel, rank, rawScore: 1 };
}

test("RRF 对多个召回通道命中的文档去重并累加分数", () => {
    const result = weightedReciprocalRankFusion([
        [candidate("dense-only", "dense", 1), candidate("shared", "dense", 2)],
        [candidate("shared", "sparse", 1)],
        [candidate("shared", "heading", 1)],
    ], weights, 60, 10);

    assert.equal(result[0].documentId, "shared");
    assert.deepEqual(Object.keys(result[0].channels).sort(), ["dense", "heading", "sparse"]);
});

test("RRF 不重复计算同一通道内的重复候选", () => {
    const [result] = weightedReciprocalRankFusion([[
        candidate("doc-1", "dense", 1),
        candidate("doc-1", "dense", 2),
    ]], weights, 60, 10);

    assert.equal(result.fusedScore, weights.dense / 61);
    assert.equal(result.channels.dense?.rank, 1);
});

test("RRF 遵守融合结果数量限制", () => {
    const result = weightedReciprocalRankFusion([[
        candidate("doc-1", "dense", 1),
        candidate("doc-2", "dense", 2),
        candidate("doc-3", "dense", 3),
    ]], weights, 60, 2);

    assert.deepEqual(result.map((item) => item.documentId), ["doc-1", "doc-2"]);
});
