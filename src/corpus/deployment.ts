import { createHash } from "node:crypto";

export const CORPUS_DEPLOYMENT_SCHEMA_VERSION = 1;

export const MARKDOWN_CHUNKING_CONFIG = {
    headerLevels: [1, 2, 3],
    recursiveThreshold: 1200,
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", "。", "，", " ", ""],
} as const;

export type CorpusDeploymentIdentityInput = {
    corpusVersion: string;
    embeddingModel: string;
};

export function createCorpusDeploymentId({
    corpusVersion,
    embeddingModel,
}: CorpusDeploymentIdentityInput): string {
    const normalizedCorpusVersion = corpusVersion.trim();
    const normalizedEmbeddingModel = embeddingModel.trim();
    if (!normalizedCorpusVersion) {
        throw new Error("生成 deployment ID 时 corpusVersion 不能为空");
    }
    if (!normalizedEmbeddingModel) {
        throw new Error("生成 deployment ID 时 embeddingModel 不能为空");
    }

    const digest = createHash("sha256")
        .update(JSON.stringify({
            schemaVersion: CORPUS_DEPLOYMENT_SCHEMA_VERSION,
            corpusVersion: normalizedCorpusVersion,
            embeddingModel: normalizedEmbeddingModel,
            chunking: MARKDOWN_CHUNKING_CONFIG,
        }), "utf8")
        .digest("hex");
    return `sha256:${digest}`;
}

export function pineconeNamespaceForDeployment(deploymentId: string): string {
    const match = /^sha256:([a-f0-9]{64})$/.exec(deploymentId.trim());
    if (!match) {
        throw new Error(`deployment ID 格式无效：${deploymentId}`);
    }
    return `cm-${match[1]}`;
}
