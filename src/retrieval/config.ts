import "dotenv/config";
import type { RetrievalWeights } from "./types.ts";

function positiveInteger(name: string, fallback: number): number {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} 必须是正整数，当前值：${process.env[name]}`);
    }
    return value;
}

function nonNegativeNumber(name: string, fallback: number): number {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${name} 必须是非负数，当前值：${process.env[name]}`);
    }
    return value;
}

const weights: RetrievalWeights = {
    dense: nonNegativeNumber("RAG_DENSE_WEIGHT", 0.45),
    sparse: nonNegativeNumber("RAG_SPARSE_WEIGHT", 0.35),
    heading: nonNegativeNumber("RAG_HEADING_WEIGHT", 0.20),
};

if (Object.values(weights).every((weight) => weight === 0)) {
    throw new Error("RAG 召回权重不能全部为 0");
}

export const retrievalConfig = {
    denseTopK: positiveInteger("RAG_DENSE_TOP_K", 20),
    sparseTopK: positiveInteger("RAG_SPARSE_TOP_K", 20),
    headingTopK: positiveInteger("RAG_HEADING_TOP_K", 10),
    fusionTopK: positiveInteger("RAG_FUSION_TOP_K", 30),
    contextTopK: positiveInteger("RAG_CONTEXT_TOP_K", 6),
    rrfK: positiveInteger("RAG_RRF_K", 60),
    weights,
} as const;
