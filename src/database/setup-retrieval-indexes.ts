import "dotenv/config";
import type { RowDataPacket } from "mysql2/promise";
import { STABLE_CHUNK_ID_LENGTH } from "../corpus/identity.ts";
import pool from "./db.ts";

interface CountRow extends RowDataPacket {
    count: number;
}

interface ColumnDefinitionRow extends RowDataPacket {
    characterMaximumLength: number | null;
}

async function columnExists(columnName: string): Promise<boolean> {
    const [rows] = await pool.query<CountRow[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'document_chunks'
          AND COLUMN_NAME = ?
    `, [columnName]);
    return rows[0].count > 0;
}

async function indexExists(indexName: string): Promise<boolean> {
    const [rows] = await pool.query<CountRow[]>(`
        SELECT COUNT(*) AS count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'document_chunks'
          AND INDEX_NAME = ?
    `, [indexName]);
    return rows[0].count > 0;
}

async function documentIdCapacity(): Promise<number | null> {
    const [rows] = await pool.query<ColumnDefinitionRow[]>(`
        SELECT CHARACTER_MAXIMUM_LENGTH AS characterMaximumLength
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'document_chunks'
          AND COLUMN_NAME = 'document_id'
    `);
    return rows[0]?.characterMaximumLength ?? null;
}

async function main() {
    const currentDocumentIdCapacity = await documentIdCapacity();
    if (currentDocumentIdCapacity === null) {
        throw new Error("document_chunks.document_id 字段不存在");
    }
    if (currentDocumentIdCapacity < STABLE_CHUNK_ID_LENGTH) {
        await pool.query(`
            ALTER TABLE document_chunks
            MODIFY COLUMN document_id VARCHAR(${STABLE_CHUNK_ID_LENGTH}) NOT NULL
        `);
        console.log(
            `已将 document_chunks.document_id 扩容为 VARCHAR(${STABLE_CHUNK_ID_LENGTH})`,
        );
    }

    if (!await columnExists("heading_text")) {
        await pool.query(`
            ALTER TABLE document_chunks
            ADD COLUMN heading_text TEXT NULL AFTER metadata
        `);
        console.log("已新增 document_chunks.heading_text");
    }

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

    console.log("三路召回所需的 MySQL 字段和索引已就绪");
}

main()
    .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
