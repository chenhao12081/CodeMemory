import assert from "node:assert/strict";
import test from "node:test";
import {
    rankCandidatesByRrf,
    rankCandidatesByScores,
} from "./reranker.ts";
import type { FusedRetrievalCandidate } from "./types.ts";

function candidate(
    documentId: string,
    fusedScore: number,
): FusedRetrievalCandidate {
    return {
        documentId,
        fusedScore,
        channels: {},
    };
}

test("Cross-Encoder 得分决定最终候选顺序", () => {
    const result = rankCandidatesByScores([
        candidate("rrf-first", 0.9),
        candidate("semantic-first", 0.2),
    ], [0.1, 0.95]);

    assert.deepEqual(
        result.map((item) => [item.documentId, item.finalRank]),
        [["semantic-first", 1], ["rrf-first", 2]],
    );
});

test("重排同分时使用 RRF 分数打破平局", () => {
    const result = rankCandidatesByScores([
        candidate("lower-rrf", 0.2),
        candidate("higher-rrf", 0.7),
    ], [0.8, 0.8]);

    assert.deepEqual(
        result.map((item) => item.documentId),
        ["higher-rrf", "lower-rrf"],
    );
});

test("重排不可用时保留 RRF 顺序并设置最终名次", () => {
    const result = rankCandidatesByRrf([
        candidate("first", 0.9),
        candidate("second", 0.8),
    ]);

    assert.deepEqual(
        result.map((item) => [item.documentId, item.finalRank, item.rerankScore]),
        [["first", 1, undefined], ["second", 2, undefined]],
    );
});

test("候选数与重排得分数不一致时拒绝静默错配", () => {
    assert.throws(
        () => rankCandidatesByScores([candidate("doc", 0.5)], []),
        /候选数与得分数不一致/,
    );
});
