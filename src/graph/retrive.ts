import type { GraphNode } from "@langchain/langgraph";
import { AgentState } from "../state/global.ts";
import { buildRetrievalContext } from "../retrieval/context-builder.ts";
import { retrievalConfig } from "../retrieval/config.ts";
import { retrieveFromMultipleChannels } from "../retrieval/retrieval-service.ts";

export const retriveNode: GraphNode<typeof AgentState> = async (state) => {
    const result = await retrieveFromMultipleChannels(state.question);
    if (result.fusedCandidates.length === 0) {
        return { context: "" };
    }

    const context = buildRetrievalContext(
        result.fusedCandidates,
        result.chunksByDocumentId,
        retrievalConfig.contextTopK,
    );
    console.log(
        `三路召回：dense=${result.counts.dense}，sparse=${result.counts.sparse}，` +
        `heading=${result.counts.heading}；RRF 融合=${result.fusedCandidates.length}，` +
        `上下文=${Math.min(retrievalConfig.contextTopK, result.fusedCandidates.length)}`,
    );

    return { context };
};
