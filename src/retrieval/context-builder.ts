import type { DocumentChunkRow } from "../tools/database.ts";
import {
    RETRIEVAL_CHANNELS,
    type RankedRetrievalCandidate,
} from "./types.ts";

function normalizeMetadata(value: unknown): Record<string, unknown> {
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === "object" && parsed !== null
                ? parsed as Record<string, unknown>
                : {};
        } catch {
            return {};
        }
    }

    return typeof value === "object" && value !== null
        ? value as Record<string, unknown>
        : {};
}

function metadataText(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function buildRetrievalContext(
    candidates: readonly RankedRetrievalCandidate[],
    chunksByDocumentId: ReadonlyMap<string, DocumentChunkRow>,
    limit: number,
): string {
    const parts: string[] = [];

    for (const candidate of candidates) {
        if (parts.length >= limit) {
            break;
        }

        const chunk = chunksByDocumentId.get(candidate.documentId);
        if (!chunk) {
            console.warn(`融合候选没有对应的文档切片：${candidate.documentId}`);
            continue;
        }

        const metadata = normalizeMetadata(chunk.metadata);
        const source = metadataText(metadata, "source")
            ?? metadataText(candidate.metadata ?? {}, "source")
            ?? "未知文档";
        const headingPath = ["h1", "h2", "h3"]
            .map((key) => metadataText(metadata, key))
            .filter((value): value is string => Boolean(value))
            .join(" / ");
        const channels = RETRIEVAL_CHANNELS
            .flatMap((channel) => {
                const hit = candidate.channels[channel];
                return hit ? [`${channel}(#${hit.rank})`] : [];
            })
            .join(", ");

        parts.push([
            `[资料 ${parts.length + 1}]`,
            `来源：${source}`,
            headingPath ? `标题：${headingPath}` : null,
            `召回通道：${channels}`,
            `融合得分：${candidate.fusedScore.toFixed(6)}`,
            candidate.rerankScore === undefined
                ? null
                : `重排得分：${candidate.rerankScore.toFixed(6)}`,
            chunk.content,
        ].filter((line): line is string => line !== null).join("\n"));
    }

    return parts.join("\n\n---\n\n");
}
