import { findLatestChunksByDocumentIds } from "./chunk-repository.ts";
import { retrievalConfig } from "./config.ts";
import { retrieveDenseCandidates } from "./dense-retriever.ts";
import { weightedReciprocalRankFusion } from "./fusion.ts";
import {
    retrieveHeadingCandidates,
    retrieveSparseCandidates,
} from "./mysql-retrievers.ts";
import {
    rankCandidatesByRrf,
    rerankCandidates,
} from "./reranker.ts";
import type {
    RetrievalCandidate,
    RetrievalChannel,
    RerankerStatus,
} from "./types.ts";

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function retrieveFromMultipleChannels(question: string) {
    const settledResults = await Promise.allSettled([
        retrieveDenseCandidates(question, retrievalConfig.denseTopK),
        retrieveSparseCandidates(question, retrievalConfig.sparseTopK),
        retrieveHeadingCandidates(question, retrievalConfig.headingTopK),
    ]);
    const channelOrder: RetrievalChannel[] = ["dense", "sparse", "heading"];
    const resultSets: RetrievalCandidate[][] = [];
    const counts: Record<RetrievalChannel, number> = {
        dense: 0,
        sparse: 0,
        heading: 0,
    };
    const errors: unknown[] = [];

    settledResults.forEach((result, index) => {
        const channel = channelOrder[index];
        if (result.status === "fulfilled") {
            counts[channel] = result.value.length;
            resultSets.push(result.value);
            return;
        }

        errors.push(result.reason);
        console.error(`${channel} 召回不可用：${errorMessage(result.reason)}`);
    });

    if (errors.length === settledResults.length) {
        throw new AggregateError(errors, "所有检索通道均不可用");
    }

    const fusedCandidates = weightedReciprocalRankFusion(
        resultSets,
        retrievalConfig.weights,
        retrievalConfig.rrfK,
        retrievalConfig.fusionTopK,
    );
    const chunksByDocumentId = await findLatestChunksByDocumentIds(
        fusedCandidates.map((candidate) => candidate.documentId),
    );
    const candidatesWithChunks = fusedCandidates
        .slice(0, retrievalConfig.rerankerTopK)
        .filter((candidate) => chunksByDocumentId.has(candidate.documentId));
    let rankedCandidates = rankCandidatesByRrf(candidatesWithChunks);
    const reranker: RerankerStatus = {
        applied: false,
        model: retrievalConfig.rerankerModel,
    };

    if (retrievalConfig.rerankerEnabled && candidatesWithChunks.length > 0) {
        try {
            rankedCandidates = await rerankCandidates(
                question,
                candidatesWithChunks,
                chunksByDocumentId,
            );
            reranker.applied = true;
        } catch (error) {
            reranker.error = errorMessage(error);
            console.error(`Cross-Encoder 重排不可用，回退到 RRF：${reranker.error}`);
            if (retrievalConfig.rerankerRequired) {
                throw error;
            }
        }
    }

    return {
        counts,
        fusedCandidates,
        rankedCandidates,
        chunksByDocumentId,
        reranker,
    };
}
