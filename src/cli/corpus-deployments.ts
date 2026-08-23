import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";
import {
    activateCorpusDeployment,
    beginCorpusDeploymentCleanup,
    finishCorpusDeploymentCleanup,
    listCorpusDeployments,
    restoreCorpusDeploymentAfterCleanupFailure,
    rollbackCorpusDeployment,
} from "../corpus/registry.ts";
import pool from "../database/db.ts";

function usage(): string {
    return [
        "用法：",
        "  pnpm corpus:list",
        "  pnpm corpus:activate -- <deployment-id>",
        "  pnpm corpus:rollback",
        "  pnpm corpus:cleanup -- <deployment-id> --confirm",
    ].join("\n");
}

function namespaceRecordCount(namespaces: unknown, namespaceName: string): number {
    if (typeof namespaces !== "object" || namespaces === null) return 0;
    const namespaceMap = namespaces as Record<string, unknown>;
    const value = namespaceName
        ? namespaceMap[namespaceName]
        : namespaceMap[""] ?? namespaceMap.__default__;
    if (typeof value !== "object" || value === null) return 0;
    const count = (value as Record<string, unknown>).recordCount;
    return typeof count === "number" ? count : 0;
}

async function waitForNamespaceDeletion(
    index: ReturnType<Pinecone["index"]>,
    namespaceName: string,
) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const stats = await index.describeIndexStats();
        if (namespaceRecordCount(stats.namespaces, namespaceName) === 0) return;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new Error(`等待 Pinecone namespace ${namespaceName || "(default)"} 清空超时`);
}

async function list() {
    const deployments = await listCorpusDeployments();
    if (deployments.length === 0) {
        console.log("尚无语料 deployment");
        return;
    }
    console.table(deployments.map((deployment) => ({
        status: deployment.status,
        deploymentId: deployment.deploymentId,
        corpusVersion: deployment.corpusVersion,
        namespace: deployment.pineconeNamespace || "(default)",
        chunks: deployment.chunkCount,
        embeddingModel: deployment.embeddingModel,
        createdAt: deployment.createdAt,
        error: deployment.errorMessage,
    })));
}

async function cleanup(deploymentId: string) {
    if (!process.argv.includes("--confirm")) {
        throw new Error("清理会永久删除该非活动版本的向量和 Chunk；请追加 --confirm");
    }
    const apiKey = process.env.PINECONE_API_KEY?.trim();
    const indexName = process.env.PINECONE_INDEX_NAME?.trim();
    if (!apiKey || !indexName) {
        throw new Error("清理需要 PINECONE_API_KEY 和 PINECONE_INDEX_NAME");
    }

    const deployment = await beginCorpusDeploymentCleanup(deploymentId);
    try {
        const index = new Pinecone({ apiKey }).index(indexName);
        if (deployment.pineconeNamespace) {
            await index.deleteAll({ namespace: deployment.pineconeNamespace });
        } else {
            await index.deleteAll();
        }
        await waitForNamespaceDeletion(index, deployment.pineconeNamespace);
        await finishCorpusDeploymentCleanup(deploymentId);
        console.log(`已清理 deployment ${deploymentId}`);
    } catch (error) {
        await restoreCorpusDeploymentAfterCleanupFailure(deploymentId, error);
        throw error;
    }
}

async function main() {
    const command = process.argv[2];
    const deploymentId = process.argv.slice(3).find((argument) => !argument.startsWith("--"));
    switch (command) {
        case "list":
            await list();
            return;
        case "activate": {
            if (!deploymentId) throw new Error(usage());
            const result = await activateCorpusDeployment(deploymentId);
            console.log(
                `已激活 ${result.active.deploymentId}；previous=${result.previousDeploymentId ?? "无"}`,
            );
            return;
        }
        case "rollback": {
            const result = await rollbackCorpusDeployment();
            console.log(
                `已回滚到 ${result.active.deploymentId}；可再次回滚到 ${result.previousDeploymentId ?? "无"}`,
            );
            return;
        }
        case "cleanup":
            if (!deploymentId) throw new Error(usage());
            await cleanup(deploymentId);
            return;
        default:
            throw new Error(usage());
    }
}

main()
    .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
