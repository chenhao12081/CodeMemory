import "dotenv/config";
import type { RowDataPacket } from "mysql2/promise";
import { STABLE_CHUNK_ID_LENGTH } from "../corpus/identity.ts";
import pool from "./db.ts";

interface CountRow extends RowDataPacket {
    count: number | string;
}

interface ColumnDefinitionRow extends RowDataPacket {
    characterMaximumLength: number | null;
    isNullable: "YES" | "NO";
    characterSetName: string | null;
    collationName: string | null;
}

interface LegacyVersionRow extends RowDataPacket {
    corpus_version: string | null;
    chunk_count: number | string;
}

interface DeploymentIdRow extends RowDataPacket {
    deployment_id: string;
}

interface RuntimeStateRow extends RowDataPacket {
    active_deployment_id: string | null;
}

interface IndexRow extends RowDataPacket {
    Key_name: string;
    Non_unique: number;
    Seq_in_index: number;
    Column_name: string;
}

async function tableExists(tableName: string): Promise<boolean> {
    const [rows] = await pool.query<CountRow[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    `, [tableName]);
    return Number(rows[0].count) > 0;
}

async function columnDefinition(columnName: string): Promise<ColumnDefinitionRow | undefined> {
    const [rows] = await pool.query<ColumnDefinitionRow[]>(`
        SELECT
            CHARACTER_MAXIMUM_LENGTH AS characterMaximumLength,
            IS_NULLABLE AS isNullable,
            CHARACTER_SET_NAME AS characterSetName,
            COLLATION_NAME AS collationName
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'document_chunks'
          AND COLUMN_NAME = ?
    `, [columnName]);
    return rows[0];
}

async function indexExists(indexName: string): Promise<boolean> {
    const [rows] = await pool.query<CountRow[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'document_chunks'
          AND INDEX_NAME = ?
    `, [indexName]);
    return Number(rows[0].count) > 0;
}

async function identifierCollationMismatch(
    tableName: string,
    columnNames: readonly string[],
): Promise<boolean> {
    const placeholders = columnNames.map(() => "?").join(", ");
    const [rows] = await pool.query<CountRow[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME IN (${placeholders})
          AND (CHARACTER_SET_NAME <> 'ascii' OR COLLATION_NAME <> 'ascii_bin')
    `, [tableName, ...columnNames]);
    return Number(rows[0].count) > 0;
}

async function ensureTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS corpus_deployments (
            deployment_id VARCHAR(${STABLE_CHUNK_ID_LENGTH}) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            corpus_version VARCHAR(${STABLE_CHUNK_ID_LENGTH}) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            pinecone_namespace VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            status VARCHAR(16) NOT NULL,
            chunk_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            embedding_model VARCHAR(255) NOT NULL,
            error_message TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ready_at TIMESTAMP NULL DEFAULT NULL,
            activated_at TIMESTAMP NULL DEFAULT NULL,
            retired_at TIMESTAMP NULL DEFAULT NULL,
            PRIMARY KEY (deployment_id),
            UNIQUE KEY uq_corpus_deployments_namespace (pinecone_namespace),
            KEY idx_corpus_deployments_status_created (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS corpus_runtime_state (
            singleton_id TINYINT UNSIGNED NOT NULL,
            active_deployment_id VARCHAR(${STABLE_CHUNK_ID_LENGTH}) CHARACTER SET ascii COLLATE ascii_bin NULL,
            previous_deployment_id VARCHAR(${STABLE_CHUNK_ID_LENGTH}) CHARACTER SET ascii COLLATE ascii_bin NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (singleton_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
        INSERT IGNORE INTO corpus_runtime_state (
            singleton_id, active_deployment_id, previous_deployment_id
        ) VALUES (1, NULL, NULL)
    `);

    if (!await tableExists("document_chunks")) {
        await pool.query(`
            CREATE TABLE document_chunks (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                deployment_id VARCHAR(${STABLE_CHUNK_ID_LENGTH}) CHARACTER SET ascii COLLATE ascii_bin NULL,
                document_id VARCHAR(${STABLE_CHUNK_ID_LENGTH}) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
                chunk_index INT UNSIGNED NOT NULL,
                content LONGTEXT NOT NULL,
                metadata JSON NOT NULL,
                heading_text TEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_document_chunks_chunk_index (chunk_index)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log("已创建 document_chunks");
    }
}

async function ensureColumns() {
    const documentId = await columnDefinition("document_id");
    if (!documentId) {
        throw new Error("document_chunks.document_id 字段不存在");
    }
    if ((documentId.characterMaximumLength ?? 0) < STABLE_CHUNK_ID_LENGTH) {
        await pool.query(`
            ALTER TABLE document_chunks
            MODIFY COLUMN document_id VARCHAR(${STABLE_CHUNK_ID_LENGTH})
                CHARACTER SET ascii COLLATE ascii_bin NOT NULL
        `);
        console.log(`已将 document_id 扩容为 VARCHAR(${STABLE_CHUNK_ID_LENGTH})`);
    }

    if (!await columnDefinition("deployment_id")) {
        await pool.query(`
            ALTER TABLE document_chunks
            ADD COLUMN deployment_id VARCHAR(${STABLE_CHUNK_ID_LENGTH})
                CHARACTER SET ascii COLLATE ascii_bin NULL AFTER id
        `);
        console.log("已新增 document_chunks.deployment_id");
    }
    if (!await columnDefinition("heading_text")) {
        await pool.query(`
            ALTER TABLE document_chunks
            ADD COLUMN heading_text TEXT NULL AFTER metadata
        `);
        console.log("已新增 document_chunks.heading_text");
    }
}

async function ensureIdentifierCollations() {
    const documentId = await columnDefinition("document_id");
    const deploymentId = await columnDefinition("deployment_id");
    if (
        documentId?.characterSetName !== "ascii"
        || documentId.collationName !== "ascii_bin"
        || deploymentId?.characterSetName !== "ascii"
        || deploymentId.collationName !== "ascii_bin"
    ) {
        await pool.query(`
            ALTER TABLE document_chunks
            MODIFY COLUMN document_id VARCHAR(${STABLE_CHUNK_ID_LENGTH})
                CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            MODIFY COLUMN deployment_id VARCHAR(${STABLE_CHUNK_ID_LENGTH})
                CHARACTER SET ascii COLLATE ascii_bin NULL
        `);
        console.log("已将 document_chunks 的稳定 ID 列统一为 ascii_bin");
    }

    if (await identifierCollationMismatch("corpus_deployments", [
        "deployment_id",
        "corpus_version",
        "pinecone_namespace",
    ])) {
        await pool.query(`
            ALTER TABLE corpus_deployments
            MODIFY COLUMN deployment_id VARCHAR(${STABLE_CHUNK_ID_LENGTH})
                CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            MODIFY COLUMN corpus_version VARCHAR(${STABLE_CHUNK_ID_LENGTH})
                CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            MODIFY COLUMN pinecone_namespace VARCHAR(128)
                CHARACTER SET ascii COLLATE ascii_bin NOT NULL
        `);
        console.log("已将 corpus_deployments 的标识列统一为 ascii_bin");
    }
    if (await identifierCollationMismatch("corpus_runtime_state", [
        "active_deployment_id",
        "previous_deployment_id",
    ])) {
        await pool.query(`
            ALTER TABLE corpus_runtime_state
            MODIFY COLUMN active_deployment_id VARCHAR(${STABLE_CHUNK_ID_LENGTH})
                CHARACTER SET ascii COLLATE ascii_bin NULL,
            MODIFY COLUMN previous_deployment_id VARCHAR(${STABLE_CHUNK_ID_LENGTH})
                CHARACTER SET ascii COLLATE ascii_bin NULL
        `);
        console.log("已将 corpus_runtime_state 的标识列统一为 ascii_bin");
    }
}

async function migrateLegacyRows() {
    const [unassignedCountRows] = await pool.query<CountRow[]>(`
        SELECT COUNT(*) AS count
        FROM document_chunks
        WHERE deployment_id IS NULL OR deployment_id = ''
    `);
    const unassignedCount = Number(unassignedCountRows[0].count);
    if (unassignedCount === 0) {
        return;
    }

    const [versionRows] = await pool.query<LegacyVersionRow[]>(`
        SELECT
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.corpus_version')), 'null')
                AS corpus_version,
            COUNT(*) AS chunk_count
        FROM document_chunks
        WHERE deployment_id IS NULL OR deployment_id = ''
        GROUP BY corpus_version
    `);
    if (versionRows.length !== 1 || !versionRows[0].corpus_version) {
        throw new Error(
            "旧 document_chunks 无法安全迁移：未分配数据必须且只能包含一个 corpus_version",
        );
    }

    const legacy = versionRows[0];
    const deploymentId = legacy.corpus_version;
    const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL?.trim() || "bge-m3";
    await pool.query(`
        INSERT INTO corpus_deployments (
            deployment_id,
            corpus_version,
            pinecone_namespace,
            status,
            chunk_count,
            embedding_model,
            ready_at,
            activated_at
        ) VALUES (?, ?, '', 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
            corpus_version = VALUES(corpus_version),
            chunk_count = VALUES(chunk_count),
            embedding_model = VALUES(embedding_model)
    `, [deploymentId, legacy.corpus_version, Number(legacy.chunk_count), embeddingModel]);
    await pool.query(`
        UPDATE document_chunks
        SET deployment_id = ?
        WHERE deployment_id IS NULL OR deployment_id = ''
    `, [deploymentId]);
    console.log(
        `已把 ${unassignedCount} 条旧数据登记为 legacy deployment ${deploymentId}（默认 namespace）`,
    );
}

async function ensureDeploymentReferences() {
    const [orphanRows] = await pool.query<DeploymentIdRow[]>(`
        SELECT DISTINCT dc.deployment_id
        FROM document_chunks dc
        LEFT JOIN corpus_deployments cd ON cd.deployment_id = dc.deployment_id
        WHERE dc.deployment_id IS NOT NULL
          AND cd.deployment_id IS NULL
        LIMIT 1
    `);
    if (orphanRows[0]) {
        throw new Error(
            `document_chunks 引用了未登记的 deployment：${orphanRows[0].deployment_id}`,
        );
    }

    const deploymentColumn = await columnDefinition("deployment_id");
    if (deploymentColumn?.isNullable === "YES") {
        await pool.query(`
            ALTER TABLE document_chunks
            MODIFY COLUMN deployment_id VARCHAR(${STABLE_CHUNK_ID_LENGTH})
                CHARACTER SET ascii COLLATE ascii_bin NOT NULL
        `);
        console.log("已将 document_chunks.deployment_id 设为 NOT NULL");
    }
}

async function ensureActiveDeployment() {
    const [stateRows] = await pool.query<RuntimeStateRow[]>(`
        SELECT active_deployment_id
        FROM corpus_runtime_state
        WHERE singleton_id = 1
    `);
    if (stateRows[0]?.active_deployment_id) {
        const [deploymentRows] = await pool.query<DeploymentIdRow[]>(`
            SELECT deployment_id
            FROM corpus_deployments
            WHERE deployment_id = ?
        `, [stateRows[0].active_deployment_id]);
        if (!deploymentRows[0]) {
            throw new Error(
                `活动指针引用了不存在的 deployment：${stateRows[0].active_deployment_id}`,
            );
        }
        return;
    }

    const [activeRows] = await pool.query<DeploymentIdRow[]>(`
        SELECT deployment_id
        FROM corpus_deployments
        WHERE status = 'active'
        ORDER BY activated_at DESC, created_at DESC
    `);
    if (activeRows.length > 1) {
        throw new Error("存在多个 active deployment，无法自动选择活动版本");
    }
    if (activeRows[0]) {
        await pool.query(`
            UPDATE corpus_runtime_state
            SET active_deployment_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE singleton_id = 1
        `, [activeRows[0].deployment_id]);
        console.log(`活动语料指针已初始化为 ${activeRows[0].deployment_id}`);
    }
}

async function ensureIndexes() {
    const [indexRows] = await pool.query<IndexRow[]>("SHOW INDEX FROM document_chunks");
    const indexes = new Map<string, IndexRow[]>();
    for (const row of indexRows) {
        const rows = indexes.get(row.Key_name) ?? [];
        rows.push(row);
        indexes.set(row.Key_name, rows);
    }
    for (const [indexName, rows] of indexes) {
        const orderedColumns = [...rows]
            .sort((left, right) => left.Seq_in_index - right.Seq_in_index)
            .map((row) => row.Column_name);
        if (
            indexName !== "PRIMARY"
            && rows[0].Non_unique === 0
            && orderedColumns.length === 1
            && orderedColumns[0] === "document_id"
        ) {
            const escapedIndexName = indexName.replaceAll("`", "``");
            await pool.query(`ALTER TABLE document_chunks DROP INDEX \`${escapedIndexName}\``);
            console.log(`已移除只允许单版本的唯一索引 ${indexName}`);
        }
    }

    if (!await indexExists("uq_document_chunks_deployment_document")) {
        await pool.query(`
            ALTER TABLE document_chunks
            ADD UNIQUE INDEX uq_document_chunks_deployment_document
                (deployment_id, document_id)
        `);
        console.log("已创建 deployment + document 复合唯一索引");
    }
    if (!await indexExists("idx_document_chunks_deployment")) {
        await pool.query(`
            ALTER TABLE document_chunks
            ADD INDEX idx_document_chunks_deployment (deployment_id)
        `);
        console.log("已创建 deployment 查询索引");
    }
    if (!await indexExists("ft_document_chunks_content_ngram")) {
        await pool.query(`
            ALTER TABLE document_chunks
            ADD FULLTEXT INDEX ft_document_chunks_content_ngram (content)
            WITH PARSER ngram
        `);
        console.log("已创建正文 ngram FULLTEXT 索引");
    }
    if (!await indexExists("ft_document_chunks_heading_ngram")) {
        await pool.query(`
            ALTER TABLE document_chunks
            ADD FULLTEXT INDEX ft_document_chunks_heading_ngram (heading_text)
            WITH PARSER ngram
        `);
        console.log("已创建标题 ngram FULLTEXT 索引");
    }
}

async function rebuildHeadingText() {
    await pool.query(`
        UPDATE document_chunks
        SET heading_text = TRIM(CONCAT_WS(' ',
            JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.source')),
            JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.category')),
            JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.h1')),
            JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.h2')),
            JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.h3'))
        ))
        WHERE heading_text IS NULL OR heading_text = ''
    `);
}

async function main() {
    await ensureTables();
    await ensureColumns();
    await ensureIdentifierCollations();
    await migrateLegacyRows();
    await ensureDeploymentReferences();
    await ensureActiveDeployment();
    await rebuildHeadingText();
    await ensureIndexes();
    console.log("版本化语料表、活动指针和三路召回索引已就绪");
}

main()
    .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
