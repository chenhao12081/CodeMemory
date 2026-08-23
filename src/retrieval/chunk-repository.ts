import pool from "../database/db.ts";
import type { DocumentChunkRow } from "../tools/database.ts";

export async function findLatestChunksByDocumentIds(
    documentIds: readonly string[],
    deploymentId: string,
): Promise<Map<string, DocumentChunkRow>> {
    if (documentIds.length === 0) {
        return new Map();
    }

    const placeholders = documentIds.map(() => "?").join(", ");
    const sql = `
        SELECT dc.*
        FROM document_chunks dc
        WHERE dc.deployment_id = ?
          AND dc.document_id IN (${placeholders})
    `;
    const [rows] = await pool.query<DocumentChunkRow[]>(sql, [deploymentId, ...documentIds]);

    return new Map(rows.map((row) => [row.document_id, row]));
}
