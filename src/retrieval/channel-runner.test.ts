import assert from "node:assert/strict";
import test from "node:test";
import { retrieveChannelsWithTrace } from "./channel-runner.ts";
import type { RetrievalCandidate, RetrievalChannel } from "./types.ts";

function candidate(
    documentId: string,
    channel: RetrievalChannel,
): RetrievalCandidate {
    return {
        documentId,
        channel,
        rank: 1,
        rawScore: 1,
    };
}

test("保留三路召回的完整原始候选和耗时", async () => {
    const result = await retrieveChannelsWithTrace({
        dense: async () => [candidate("dense-doc", "dense")],
        sparse: async () => [candidate("sparse-doc", "sparse")],
        heading: async () => [candidate("heading-doc", "heading")],
    });

    assert.deepEqual(
        result.channelResults.dense.candidates.map((item) => item.documentId),
        ["dense-doc"],
    );
    assert.deepEqual(
        result.channelResults.sparse.candidates.map((item) => item.documentId),
        ["sparse-doc"],
    );
    assert.deepEqual(
        result.channelResults.heading.candidates.map((item) => item.documentId),
        ["heading-doc"],
    );
    assert.equal(result.failures.length, 0);
    assert.ok(result.recallMs >= 0);
    assert.ok(
        Object.values(result.channelResults).every(({ latencyMs }) => latencyMs >= 0),
    );
});

test("单路失败时记录错误并保留其他通道结果", async () => {
    const result = await retrieveChannelsWithTrace({
        dense: async () => [candidate("dense-doc", "dense")],
        sparse: async () => {
            throw new Error("MySQL unavailable");
        },
        heading: async () => [candidate("heading-doc", "heading")],
    });

    assert.deepEqual(result.channelResults.sparse.candidates, []);
    assert.equal(result.channelResults.sparse.error, "MySQL unavailable");
    assert.deepEqual(
        result.failures.map(({ channel }) => channel),
        ["sparse"],
    );
    assert.equal(result.channelResults.dense.error, undefined);
    assert.equal(result.channelResults.heading.error, undefined);
});
