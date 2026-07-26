import { performance } from "node:perf_hooks";
import {
    RETRIEVAL_CHANNELS,
    type RetrievalCandidate,
    type RetrievalChannel,
    type RetrievalChannelResults,
} from "./types.ts";

export type RetrievalChannelRetrievers = Record<
    RetrievalChannel,
    () => Promise<RetrievalCandidate[]>
>;

export type RetrievalChannelFailure = {
    channel: RetrievalChannel;
    error: unknown;
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function retrieveChannelsWithTrace(
    retrievers: RetrievalChannelRetrievers,
) {
    const recallStartedAt = performance.now();
    const executions = await Promise.all(
        RETRIEVAL_CHANNELS.map(async (channel) => {
            const channelStartedAt = performance.now();
            try {
                const candidates = await retrievers[channel]();
                return {
                    channel,
                    result: {
                        candidates,
                        latencyMs: performance.now() - channelStartedAt,
                    },
                };
            } catch (error) {
                return {
                    channel,
                    result: {
                        candidates: [],
                        latencyMs: performance.now() - channelStartedAt,
                        error: errorMessage(error),
                    },
                    failure: {
                        channel,
                        error,
                    } satisfies RetrievalChannelFailure,
                };
            }
        }),
    );

    const channelResults = Object.fromEntries(
        executions.map(({ channel, result }) => [channel, result]),
    ) as RetrievalChannelResults;
    const failures = executions.flatMap((execution) =>
        execution.failure ? [execution.failure] : []);

    return {
        channelResults,
        failures,
        recallMs: performance.now() - recallStartedAt,
    };
}
