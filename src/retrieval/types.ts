export const RETRIEVAL_CHANNELS = ["dense", "sparse", "heading"] as const;

export type RetrievalChannel = (typeof RETRIEVAL_CHANNELS)[number];

export type RetrievalCandidate = {
    documentId: string;
    channel: RetrievalChannel;
    rank: number;
    rawScore: number;
    metadata?: Record<string, unknown>;
};

export type RetrievalChannelResult = {
    candidates: RetrievalCandidate[];
    latencyMs: number;
    error?: string;
};

export type RetrievalChannelResults = Record<
    RetrievalChannel,
    RetrievalChannelResult
>;

export type RetrievalStageTimings = {
    recallMs: number;
    fusionMs: number;
    chunkLookupMs: number;
    rerankMs: number;
    totalMs: number;
};

export type RetrievalChannelHit = {
    rank: number;
    rawScore: number;
};

export type FusedRetrievalCandidate = {
    documentId: string;
    fusedScore: number;
    channels: Partial<Record<RetrievalChannel, RetrievalChannelHit>>;
    metadata?: Record<string, unknown>;
};

export type RankedRetrievalCandidate = FusedRetrievalCandidate & {
    finalRank: number;
    rerankScore?: number;
};

export type RerankerStatus = {
    applied: boolean;
    model: string;
    error?: string;
};

export type RetrievalWeights = Record<RetrievalChannel, number>;
