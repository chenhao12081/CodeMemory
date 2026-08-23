import type { RowDataPacket } from "mysql2/promise";
import pool from "../database/db.ts";
import type { RetrievalCandidate, RetrievalChannel } from "./types.ts";

type FullTextColumn = "content" | "heading_text";

interface FullTextResultRow extends RowDataPacket {
    document_id: string;
    score: number | string;
}

function retrievalSetupError(channel: RetrievalChannel, error: unknown): Error {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const message = error instanceof Error ? error.message : String(error);

    if (code === "ER_BAD_FIELD_ERROR" || code === "ER_FT_MATCHING_KEY_NOT_FOUND") {
        return new Error(
            `${channel} 召回所需的字段或全文索引不存在，请先运行 pnpm setup:retrieval-indexes`,
            { cause: error },
        );
    }

    return new Error(`${channel} 召回失败：${message}`, { cause: error });
}

async function retrieveFullTextCandidates({
    question,
    topK,
    column,
    channel,
    deploymentId,
}: {
    question: string;
    topK: number;
    column: FullTextColumn;
    channel: RetrievalChannel;
    deploymentId: string;
}): Promise<RetrievalCandidate[]> {
    const sql = `
        SELECT
            dc.document_id,
            MATCH(dc.${column}) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
        FROM document_chunks dc
        WHERE dc.deployment_id = ?
          AND MATCH(dc.${column}) AGAINST (? IN NATURAL LANGUAGE MODE) > 0
        ORDER BY score DESC
        LIMIT ?
    `;

    try {
        const [rows] = await pool.query<FullTextResultRow[]>(
            sql,
            [question, deploymentId, question, topK],
        );
        return rows.map((row, index) => ({
            documentId: row.document_id,
            channel,
            rank: index + 1,
            rawScore: Number(row.score),
        }));
    } catch (error) {
        throw retrievalSetupError(channel, error);
    }
}

export function retrieveSparseCandidates(
    question: string,
    topK: number,
    deploymentId: string,
): Promise<RetrievalCandidate[]> {
    return retrieveFullTextCandidates({
        question,
        topK,
        column: "content",
        channel: "sparse",
        deploymentId,
    });
}

export function retrieveHeadingCandidates(
    question: string,
    topK: number,
    deploymentId: string,
): Promise<RetrievalCandidate[]> {
    return retrieveFullTextCandidates({
        question,
        topK,
        column: "heading_text",
        channel: "heading",
        deploymentId,
    });
}
