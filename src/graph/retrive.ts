import type { GraphNode } from "@langchain/langgraph";
import { AgentState } from "../state/global.ts";
import { buildRetrievalContext } from "../retrieval/context-builder.ts";
import { retrievalConfig } from "../retrieval/config.ts";
import { retrieveFromMultipleChannels } from "../retrieval/retrieval-service.ts";

export const retriveNode: GraphNode<typeof AgentState> = async (state) => {
    const result = await retrieveFromMultipleChannels(state.question);
    if (result.rankedCandidates.length === 0) {
        return { context: "" };
    }

    const context = buildRetrievalContext(
        result.rankedCandidates,
        result.chunksByDocumentId,
        retrievalConfig.contextTopK,
    );
    const rerankerSummary = result.reranker.applied
        ? `Cross-Encoder 重排=${result.rankedCandidates.length}`
        : "Cross-Encoder 未应用，使用 RRF 排序";
    console.log(
        `三路召回：dense=${result.counts.dense}，sparse=${result.counts.sparse}，` +
        `heading=${result.counts.heading}；RRF 融合=${result.fusedCandidates.length}，` +
        `${rerankerSummary}；` +
        `上下文=${Math.min(retrievalConfig.contextTopK, result.rankedCandidates.length)}`,
    );

    return { context };
};
