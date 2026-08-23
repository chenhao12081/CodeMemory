import ollama from "ollama";
import { index } from "../verctor/index.ts";
import type { RetrievalCandidate } from "./types.ts";

export async function retrieveDenseCandidates(
    question: string,
    topK: number,
    pineconeNamespace: string,
): Promise<RetrievalCandidate[]> {
    const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL?.trim() || "bge-m3";
    const embeddingResult = await ollama.embed({
        model: embeddingModel,
        input: question,
    });

    const targetIndex = pineconeNamespace ? index.namespace(pineconeNamespace) : index;
    const searchResults = await targetIndex.query({
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
