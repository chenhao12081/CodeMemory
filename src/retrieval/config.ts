import "dotenv/config";
import { resolve } from "node:path";
import type { DataType, DeviceType } from "@huggingface/transformers";
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

function booleanValue(name: string, fallback: boolean): boolean {
    const rawValue = process.env[name];
    if (rawValue === undefined) {
        return fallback;
    }

    const normalized = rawValue.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }

    throw new Error(`${name} 必须是布尔值，当前值：${rawValue}`);
}

function nonEmptyString(name: string, fallback: string): string {
    const value = process.env[name]?.trim() || fallback;
    if (!value) {
        throw new Error(`${name} 不能为空`);
    }
    return value;
}

const supportedDtypes = new Set<DataType>([
    "auto",
    "fp32",
    "fp16",
    "q8",
    "int8",
    "uint8",
    "q4",
    "bnb4",
    "q4f16",
]);
const supportedDevices = new Set<DeviceType>([
    "auto",
    "gpu",
    "cpu",
    "wasm",
    "webgpu",
    "cuda",
    "dml",
    "webnn",
    "webnn-npu",
    "webnn-gpu",
    "webnn-cpu",
]);

function rerankerDtype(): DataType {
    const value = nonEmptyString("RAG_RERANKER_DTYPE", "q8") as DataType;
    if (!supportedDtypes.has(value)) {
        throw new Error(`RAG_RERANKER_DTYPE 不受支持：${value}`);
    }
    return value;
}

function rerankerDevice(): DeviceType {
    const value = nonEmptyString("RAG_RERANKER_DEVICE", "cpu") as DeviceType;
    if (!supportedDevices.has(value)) {
        throw new Error(`RAG_RERANKER_DEVICE 不受支持：${value}`);
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

const fusionTopK = positiveInteger("RAG_FUSION_TOP_K", 30);

export const retrievalConfig = {
    denseTopK: positiveInteger("RAG_DENSE_TOP_K", 20),
    sparseTopK: positiveInteger("RAG_SPARSE_TOP_K", 20),
    headingTopK: positiveInteger("RAG_HEADING_TOP_K", 10),
    fusionTopK,
    contextTopK: positiveInteger("RAG_CONTEXT_TOP_K", 6),
    rrfK: positiveInteger("RAG_RRF_K", 60),
    weights,
    rerankerEnabled: booleanValue("RAG_RERANKER_ENABLED", true),
    rerankerRequired: booleanValue("RAG_RERANKER_REQUIRED", false),
    rerankerModel: nonEmptyString(
        "RAG_RERANKER_MODEL",
        "onnx-community/bge-reranker-v2-m3-ONNX",
    ),
    rerankerRevision: nonEmptyString("RAG_RERANKER_REVISION", "main"),
    rerankerDtype: rerankerDtype(),
    rerankerDevice: rerankerDevice(),
    rerankerCacheDir: resolve(
        process.cwd(),
        nonEmptyString("RAG_RERANKER_CACHE_DIR", ".cache/huggingface"),
    ),
    rerankerLocalFilesOnly: booleanValue("RAG_RERANKER_LOCAL_FILES_ONLY", false),
    rerankerTopK: Math.min(
        positiveInteger("RAG_RERANKER_TOP_K", 30),
        fusionTopK,
    ),
    rerankerBatchSize: positiveInteger("RAG_RERANKER_BATCH_SIZE", 4),
    rerankerMaxLength: positiveInteger("RAG_RERANKER_MAX_LENGTH", 1024),
} as const;
