import { performance } from "node:perf_hooks";
import { getActiveCorpusDeployment } from "../corpus/registry.ts";
import { findLatestChunksByDocumentIds } from "./chunk-repository.ts";
import { retrieveChannelsWithTrace } from "./channel-runner.ts";
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
    RetrievalChannel,
    RerankerStatus,
    RetrievalStageTimings,
} from "./types.ts";

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function retrieveFromMultipleChannels(question: string) {
    const totalStartedAt = performance.now();
    const deployment = await getActiveCorpusDeployment();
    const recall = await retrieveChannelsWithTrace({
        dense: () => retrieveDenseCandidates(
            question,
            retrievalConfig.denseTopK,
            deployment.pineconeNamespace,
        ),
        sparse: () => retrieveSparseCandidates(
            question,
            retrievalConfig.sparseTopK,
            deployment.deploymentId,
        ),
        heading: () => retrieveHeadingCandidates(
            question,
            retrievalConfig.headingTopK,
            deployment.deploymentId,
        ),
    });
    const { channelResults } = recall;
    const counts = Object.fromEntries(
        Object.entries(channelResults).map(([channel, result]) => [
            channel,
            result.candidates.length,
        ]),
    ) as Record<RetrievalChannel, number>;

    for (const failure of recall.failures) {
        console.error(`${failure.channel} 召回不可用：${errorMessage(failure.error)}`);
    }
    if (recall.failures.length === Object.keys(channelResults).length) {
        throw new AggregateError(
            recall.failures.map(({ error }) => error),
            "所有检索通道均不可用",
        );
    }

    const fusionStartedAt = performance.now();
    const fusedCandidates = weightedReciprocalRankFusion(
        Object.values(channelResults).map(({ candidates }) => candidates),
        retrievalConfig.weights,
        retrievalConfig.rrfK,
        retrievalConfig.fusionTopK,
    );
    const fusionMs = performance.now() - fusionStartedAt;

    const chunkLookupStartedAt = performance.now();
    const chunksByDocumentId = await findLatestChunksByDocumentIds(
        fusedCandidates.map((candidate) => candidate.documentId),
        deployment.deploymentId,
    );
    const chunkLookupMs = performance.now() - chunkLookupStartedAt;
    const candidatesWithChunks = fusedCandidates
        .slice(0, retrievalConfig.rerankerTopK)
        .filter((candidate) => chunksByDocumentId.has(candidate.documentId));
    let rankedCandidates = rankCandidatesByRrf(candidatesWithChunks);
    const reranker: RerankerStatus = {
        applied: false,
        model: retrievalConfig.rerankerModel,
    };

    const rerankStartedAt = performance.now();
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
    const rerankMs = retrievalConfig.rerankerEnabled && candidatesWithChunks.length > 0
        ? performance.now() - rerankStartedAt
        : 0;
    const timings: RetrievalStageTimings = {
        recallMs: recall.recallMs,
        fusionMs,
        chunkLookupMs,
        rerankMs,
        totalMs: performance.now() - totalStartedAt,
    };

    return {
        deployment,
        counts,
        channelResults,
        fusedCandidates,
        rankedCandidates,
        chunksByDocumentId,
        reranker,
        timings,
    };
}
