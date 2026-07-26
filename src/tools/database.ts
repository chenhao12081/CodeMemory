import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "../database/db.ts";

export interface DocumentChunk {
    document_id: string;
    chunk_index: number;
    content: string;
    metadata: Record<string, any>;
}

export interface DocumentChunkRow extends RowDataPacket {
    id: number;
    document_id: string;
    chunk_index: number;
    content: string;
    metadata: any; // MySQL 中的 JSON 类型，mysql2 查出来后会自动解析为 JS 对象
    heading_text: string | null;
    created_at: Date;
}

export function buildHeadingText(metadata: Record<string, any>): string {
    return ["source", "category", "h1", "h2", "h3"]
        .map((key) => metadata[key])
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        .map((value) => value.trim())
        .join(" ");
}

// 批量保存数据到 mysqk数据库
export async function saveChunksToDB(chunks: DocumentChunk[]) {
    if (!chunks || chunks.length === 0) return;

    try {
        const values = chunks.map(chunk => [
            chunk.document_id,
            chunk.chunk_index,
            chunk.content,
            JSON.stringify(chunk.metadata), // MySQL 的 JSON 字段需要传入字符串
            buildHeadingText(chunk.metadata),
        ]);
        const sql = `
            INSERT INTO document_chunks 
            (document_id, chunk_index, content, metadata, heading_text)
            VALUES ?
        `;
        const [result] = await pool.query<ResultSetHeader>(sql, [values]);

        console.log(`成功批量插入 ${result.affectedRows} 条切片数据！`);
        return result.affectedRows;
    } catch (error) {
        console.error('保存切片数据到 MySQL 失败:', error);
        throw error;
    }
}

export async function replaceChunksInDB(chunks: DocumentChunk[]) {
    if (!chunks || chunks.length === 0) {
        throw new Error("不能使用空语料替换 document_chunks");
    }

    const connection = await pool.getConnection();
    const values = chunks.map(chunk => [
        chunk.document_id,
        chunk.chunk_index,
        chunk.content,
        JSON.stringify(chunk.metadata),
        buildHeadingText(chunk.metadata),
    ]);
    const sql = `
        INSERT INTO document_chunks
        (document_id, chunk_index, content, metadata, heading_text)
        VALUES ?
    `;

    try {
        await connection.beginTransaction();
        await connection.query("DELETE FROM document_chunks");
        const [result] = await connection.query<ResultSetHeader>(sql, [values]);
        await connection.commit();
        console.log(`已用 ${result.affectedRows} 条稳定 ID 切片替换 MySQL 语料`);
        return result.affectedRows;
    } catch (error) {
        await connection.rollback();
        console.error("替换 MySQL 语料失败，事务已回滚：", error);
        throw error;
    } finally {
        connection.release();
    }
}
