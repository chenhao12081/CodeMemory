import {
    AutoModelForSequenceClassification,
    AutoTokenizer,
    type PreTrainedModel,
    type PreTrainedTokenizer,
} from "@huggingface/transformers";
import type { DocumentChunkRow } from "../tools/database.ts";
import { retrievalConfig } from "./config.ts";
import type {
    FusedRetrievalCandidate,
    RankedRetrievalCandidate,
} from "./types.ts";

type RerankerRuntime = {
    model: PreTrainedModel;
    tokenizer: PreTrainedTokenizer;
};

type LogitsOutput = {
    logits: {
        data: ArrayLike<number | bigint>;
    };
};

let runtimePromise: Promise<RerankerRuntime> | undefined;

function sigmoid(value: number): number {
    if (value >= 0) {
        return 1 / (1 + Math.exp(-value));
    }

    const exponential = Math.exp(value);
    return exponential / (1 + exponential);
}

function chunkPassage(chunk: DocumentChunkRow): string {
    const heading = chunk.heading_text?.trim();
    return [
        heading ? `标题：${heading}` : null,
        `正文：${chunk.content.trim()}`,
    ].filter((part): part is string => part !== null).join("\n");
}

async function loadRuntime(): Promise<RerankerRuntime> {
    if (!runtimePromise) {
        console.log(
            `正在加载重排模型 ${retrievalConfig.rerankerModel}` +
            `（${retrievalConfig.rerankerDtype} / ${retrievalConfig.rerankerDevice}）`,
        );
        const commonOptions = {
            cache_dir: retrievalConfig.rerankerCacheDir,
            local_files_only: retrievalConfig.rerankerLocalFilesOnly,
            revision: retrievalConfig.rerankerRevision,
        };

        runtimePromise = Promise.all([
            AutoTokenizer.from_pretrained(
                retrievalConfig.rerankerModel,
                commonOptions,
            ),
            AutoModelForSequenceClassification.from_pretrained(
                retrievalConfig.rerankerModel,
                {
                    ...commonOptions,
                    device: retrievalConfig.rerankerDevice,
                    dtype: retrievalConfig.rerankerDtype,
                },
            ),
        ]).then(([tokenizer, model]) => {
            console.log(`重排模型加载完成：${retrievalConfig.rerankerModel}`);
            return { tokenizer, model };
        }).catch((error: unknown) => {
            // 允许后续请求重试，例如首次下载时遇到临时网络故障。
            runtimePromise = undefined;
            throw error;
        });
    }

    return runtimePromise;
}

export function rankCandidatesByRrf(
    candidates: readonly FusedRetrievalCandidate[],
): RankedRetrievalCandidate[] {
    return candidates.map((candidate, index) => ({
        ...candidate,
        finalRank: index + 1,
    }));
}

export function rankCandidatesByScores(
    candidates: readonly FusedRetrievalCandidate[],
    scores: readonly number[],
): RankedRetrievalCandidate[] {
    if (candidates.length !== scores.length) {
        throw new Error(
            `重排候选数与得分数不一致：candidates=${candidates.length}, scores=${scores.length}`,
        );
    }

    return candidates
        .map((candidate, index) => ({
            ...candidate,
            finalRank: 0,
            rerankScore: scores[index],
        }))
        .sort((left, right) =>
            (right.rerankScore ?? 0) - (left.rerankScore ?? 0)
            || right.fusedScore - left.fusedScore
            || left.documentId.localeCompare(right.documentId))
        .map((candidate, index) => ({
            ...candidate,
            finalRank: index + 1,
        }));
}

export async function rerankCandidates(
    question: string,
    candidates: readonly FusedRetrievalCandidate[],
    chunksByDocumentId: ReadonlyMap<string, DocumentChunkRow>,
): Promise<RankedRetrievalCandidate[]> {
    const rerankableCandidates = candidates
        .slice(0, retrievalConfig.rerankerTopK)
        .filter((candidate) => chunksByDocumentId.has(candidate.documentId));

    if (rerankableCandidates.length === 0) {
        return [];
    }

    const runtime = await loadRuntime();
    const scores: number[] = [];

    for (
        let offset = 0;
        offset < rerankableCandidates.length;
        offset += retrievalConfig.rerankerBatchSize
    ) {
        const batch = rerankableCandidates.slice(
            offset,
            offset + retrievalConfig.rerankerBatchSize,
        );
        const passages = batch.map((candidate) =>
            chunkPassage(chunksByDocumentId.get(candidate.documentId)!));
        const inputs = runtime.tokenizer(
            batch.map(() => question),
            {
                text_pair: passages,
                padding: true,
                truncation: true,
                max_length: retrievalConfig.rerankerMaxLength,
            },
        );
        const output = await runtime.model(inputs) as LogitsOutput;
        const logits = Array.from(output.logits.data, (value) => Number(value));

        if (logits.length !== batch.length) {
            throw new Error(
                `重排模型输出维度异常：batch=${batch.length}, logits=${logits.length}`,
            );
        }
        scores.push(...logits.map(sigmoid));
    }

    return rankCandidatesByScores(rerankableCandidates, scores);
}
