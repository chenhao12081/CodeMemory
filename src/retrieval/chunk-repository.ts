import pool from "../database/db.ts";
import type { DocumentChunkRow } from "../tools/database.ts";

export async function findLatestChunksByDocumentIds(
    documentIds: readonly string[],
): Promise<Map<string, DocumentChunkRow>> {
    if (documentIds.length === 0) {
        return new Map();
    }

    const placeholders = documentIds.map(() => "?").join(", ");
    const sql = `
        SELECT dc.*
        FROM document_chunks dc
        INNER JOIN (
            SELECT document_id, MAX(id) AS latest_id
            FROM document_chunks
            WHERE document_id IN (${placeholders})
            GROUP BY document_id
        ) latest ON latest.latest_id = dc.id
    `;
    const [rows] = await pool.query<DocumentChunkRow[]>(sql, [...documentIds]);

    return new Map(rows.map((row) => [row.document_id, row]));
}
