import { createHash } from "node:crypto";

export const CHUNK_IDENTITY_SCHEMA_VERSION = 1;
export const CORPUS_VERSION_SCHEMA_VERSION = 1;
export const HASH_ID_PREFIX = "sha256:";
export const STABLE_CHUNK_ID_LENGTH = HASH_ID_PREFIX.length + 64;

export type ChunkHeadings = {
    h1?: string;
    h2?: string;
    h3?: string;
};

export type StableChunkIdentityInput = {
    source: string;
    headings?: ChunkHeadings;
    content: string;
};

function normalizeText(value: string): string {
    return value
        .normalize("NFC")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .trim();
}

function hashCanonicalValue(value: unknown): string {
    const digest = createHash("sha256")
        .update(JSON.stringify(value), "utf8")
        .digest("hex");
    return `${HASH_ID_PREFIX}${digest}`;
}

export function createStableChunkId({
    source,
    headings = {},
    content,
}: StableChunkIdentityInput): string {
    const normalizedSource = normalizeText(source).replace(/\\/g, "/");
    const normalizedContent = normalizeText(content);

    if (!normalizedSource) {
        throw new Error("生成稳定 chunk ID 时 source 不能为空");
    }
    if (!normalizedContent) {
        throw new Error("生成稳定 chunk ID 时 content 不能为空");
    }

    return hashCanonicalValue({
        schemaVersion: CHUNK_IDENTITY_SCHEMA_VERSION,
        source: normalizedSource,
        headings: {
            h1: normalizeText(headings.h1 ?? ""),
            h2: normalizeText(headings.h2 ?? ""),
            h3: normalizeText(headings.h3 ?? ""),
        },
        content: normalizedContent,
    });
}

export function createCorpusVersion(chunkIds: readonly string[]): string {
    const normalizedChunkIds = [...new Set(
        chunkIds.map((chunkId) => normalizeText(chunkId)),
    )].sort();

    if (normalizedChunkIds.length === 0 || normalizedChunkIds.some((chunkId) => !chunkId)) {
        throw new Error("生成 corpusVersion 时至少需要一个有效的 chunk ID");
    }

    return hashCanonicalValue({
        schemaVersion: CORPUS_VERSION_SCHEMA_VERSION,
        chunkIds: normalizedChunkIds,
    });
}
