import "dotenv/config";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

type CheckStatus = "ok" | "error";
type CheckResult = {
    check: string;
    status: CheckStatus;
    detail: string;
};

const checks: CheckResult[] = [];

function record(check: string, status: CheckStatus, detail: string) {
    checks.push({ check, status, detail });
}

function configuredValue(name: string, fallback?: string): string | undefined {
    return process.env[name]?.trim() || fallback;
}

function isPlaceholder(value: string | undefined): boolean {
    return !value || value.startsWith("replace-with-");
}

function checkNodeVersion() {
    const [major, minor] = process.versions.node.split(".").map(Number);
    const supported = major > 22 || (major === 22 && minor >= 18);
    record(
        "Node.js",
        supported ? "ok" : "error",
        supported
            ? `${process.versions.node}（满足 >=22.18）`
            : `${process.versions.node}（需要 >=22.18，以直接运行 TypeScript）`,
    );
}

function checkConfiguration() {
    const requiredSecrets = ["DEEPSEEK_API_KEY", "PINECONE_API_KEY"];
    for (const name of requiredSecrets) {
        const value = configuredValue(name);
        record(
            name,
            isPlaceholder(value) ? "error" : "ok",
            isPlaceholder(value) ? "未配置或仍是占位符" : "已配置（值已隐藏）",
        );
    }

    const pineconeIndexName = configuredValue("PINECONE_INDEX_NAME");
    record(
        "PINECONE_INDEX_NAME",
        pineconeIndexName ? "ok" : "error",
        pineconeIndexName || "未配置",
    );

    const port = Number(configuredValue("DB_PORT", "3306"));
    const validPort = Number.isInteger(port) && port > 0 && port <= 65535;
    record(
        "MySQL 配置",
        validPort ? "ok" : "error",
        validPort
            ? `${configuredValue("DB_HOST", "localhost")}:${port}/${configuredValue("DB_DATABASE", "test")}`
            : `DB_PORT 无效：${configuredValue("DB_PORT")}`,
    );
}

function checkCorpus() {
    const corpusDirectory = resolve(
        process.cwd(),
        configuredValue("CORPUS_DIR", "src/static")!,
    );
    if (!existsSync(corpusDirectory)) {
        record("语料目录", "error", `不存在：${corpusDirectory}`);
        return;
    }

    const markdownFiles = readdirSync(corpusDirectory)
        .filter((file) => file.endsWith(".md"));
    record(
        "语料目录",
        markdownFiles.length > 0 ? "ok" : "error",
        markdownFiles.length > 0
            ? `${corpusDirectory}（${markdownFiles.length} 个 Markdown）`
            : `${corpusDirectory} 中没有 Markdown 文件`,
    );
}

async function checkMySqlService() {
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection({
        host: configuredValue("DB_HOST", "localhost"),
        port: Number(configuredValue("DB_PORT", "3306")),
        user: configuredValue("DB_USER", "root"),
        password: configuredValue("DB_PASSWORD", "password"),
        database: configuredValue("DB_DATABASE", "test"),
        connectTimeout: 5_000,
    });

    try {
        await connection.query("SELECT 1");
        record("MySQL 服务", "ok", "连接成功");
    } finally {
        await connection.end();
    }
}

async function checkOllamaService() {
    const ollama = (await import("ollama")).default;
    const response = await ollama.list();
    const installedModels = new Set(response.models.map((model) => model.model));
    const expectedModels = [
        configuredValue("OLLAMA_EMBEDDING_MODEL", "bge-m3")!,
        configuredValue("OLLAMA_CHAT_MODEL", "qwen2.5-intent-q4")!,
    ];
    const missingModels = expectedModels.filter((model) => {
        if (installedModels.has(model)) {
            return false;
        }
        return model.includes(":") || !installedModels.has(`${model}:latest`);
    });

    record(
        "Ollama 服务",
        missingModels.length === 0 ? "ok" : "error",
        missingModels.length === 0
            ? `连接成功，模型已安装：${expectedModels.join("、")}`
            : `缺少模型：${missingModels.join("、")}`,
    );
}

async function checkPineconeService() {
    const { Pinecone } = await import("@pinecone-database/pinecone");
    const apiKey = configuredValue("PINECONE_API_KEY")!;
    const indexName = configuredValue("PINECONE_INDEX_NAME")!;
    const pinecone = new Pinecone({ apiKey });
    const stats = await pinecone.index(indexName).describeIndexStats();
    const vectorCount = Object.values(stats.namespaces ?? {})
        .reduce((sum, namespace) => sum + (namespace.recordCount ?? 0), 0);
    record("Pinecone 服务", "ok", `索引 ${indexName} 可访问，向量数=${vectorCount}`);
}

async function runServiceCheck(name: string, check: () => Promise<void>) {
    try {
        await check();
    } catch (error) {
        record(
            name,
            "error",
            error instanceof Error ? error.message : String(error),
        );
    }
}

async function main() {
    checkNodeVersion();
    checkConfiguration();
    checkCorpus();

    if (process.argv.includes("--services")) {
        await runServiceCheck("MySQL 服务", checkMySqlService);
        await runServiceCheck("Ollama 服务", checkOllamaService);
        if (
            !isPlaceholder(configuredValue("PINECONE_API_KEY"))
            && configuredValue("PINECONE_INDEX_NAME")
        ) {
            await runServiceCheck("Pinecone 服务", checkPineconeService);
        }
    }

    console.table(checks);
    const failures = checks.filter((check) => check.status === "error");
    if (failures.length > 0) {
        console.error(`环境检查失败：${failures.length} 项未通过`);
        process.exitCode = 1;
        return;
    }
    console.log("环境检查通过");
}

await main();
