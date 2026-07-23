import type {
    FusedRetrievalCandidate,
    RetrievalCandidate,
    RetrievalWeights,
} from "./types.ts";

export function weightedReciprocalRankFusion(
    resultSets: readonly (readonly RetrievalCandidate[])[],
    weights: RetrievalWeights,
    rrfK: number,
    limit: number,
): FusedRetrievalCandidate[] {
    const fusedByDocumentId = new Map<string, FusedRetrievalCandidate>();

    for (const resultSet of resultSets) {
        for (const candidate of resultSet) {
            const existing = fusedByDocumentId.get(candidate.documentId) ?? {
                documentId: candidate.documentId,
                fusedScore: 0,
                channels: {},
                metadata: candidate.metadata,
            };

            // 同一召回通道内的重复候选只贡献一次分数。
            if (!existing.channels[candidate.channel]) {
                existing.fusedScore += weights[candidate.channel] / (rrfK + candidate.rank);
                existing.channels[candidate.channel] = {
                    rank: candidate.rank,
                    rawScore: candidate.rawScore,
                };
            }

            if (!existing.metadata && candidate.metadata) {
                existing.metadata = candidate.metadata;
            }
            fusedByDocumentId.set(candidate.documentId, existing);
        }
    }

    return [...fusedByDocumentId.values()]
        .sort((left, right) =>
            right.fusedScore - left.fusedScore || left.documentId.localeCompare(right.documentId))
        .slice(0, limit);
}
