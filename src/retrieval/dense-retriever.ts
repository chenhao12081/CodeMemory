import ollama from "ollama";
import { index } from "../verctor/index.ts";
import type { RetrievalCandidate } from "./types.ts";

export async function retrieveDenseCandidates(
    question: string,
    topK: number,
): Promise<RetrievalCandidate[]> {
    const embeddingResult = await ollama.embed({
        model: "bge-m3",
        input: question,
    });

    const searchResults = await index.query({
        vector: embeddingResult.embeddings[0],
        topK,
        includeMetadata: true,
    });

    return searchResults.matches.map((match, index) => ({
        documentId: match.id,
        channel: "dense",
        rank: index + 1,
        rawScore: typeof match.score === "number" ? match.score : 0,
        metadata: match.metadata as Record<string, unknown> | undefined,
    }));
}
