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
    created_at: Date;
}

// 批量保存数据到 mysqk数据库
export async function saveChunksToDB(chunks: DocumentChunk[]) {
    if (!chunks || chunks.length === 0) return;

    try {
        const values = chunks.map(chunk => [
            chunk.document_id,
            chunk.chunk_index,
            chunk.content,
            JSON.stringify(chunk.metadata) // MySQL 的 JSON 字段需要传入字符串
        ]);
        const sql = `
            INSERT INTO document_chunks 
            (document_id, chunk_index, content, metadata) 
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
