import type { GraphNode } from "@langchain/langgraph";
import ollama from "ollama";
import pool from "../database/db.ts";
import { AgentState } from "../state/global.ts";
import type { DocumentChunkRow } from "../tools/database.ts";
import { index } from "../verctor/index.ts";

export const retriveNode: GraphNode<typeof AgentState> = async (state) => {
    const intentEmbedding = await ollama.embed({
        model: "bge-m3",
        input: state.question,
    });

    const searchResults = await index.query({
        vector: intentEmbedding.embeddings[0],
        topK: 3,
        includeMetadata: true,
    });

    const matches = searchResults.matches;
    if (matches.length === 0) {
        return { context: "" };
    }

    const documentIds = [...new Set(matches.map((match) => match.id))];
    const placeholders = documentIds.map(() => "?").join(", ");

    try {
        const sql = `
            SELECT *
            FROM document_chunks
            WHERE document_id IN (${placeholders})
            ORDER BY id DESC
        `;
        const [rows] = await pool.query<DocumentChunkRow[]>(sql, documentIds);

        // 重复执行入库脚本时可能存在相同 document_id，优先使用最新一条。
        const rowsByDocumentId = new Map<string, DocumentChunkRow>();
        for (const row of rows) {
            if (!rowsByDocumentId.has(row.document_id)) {
                rowsByDocumentId.set(row.document_id, row);
            }
        }

        // MySQL 的 IN 查询不保证顺序，因此按 Pinecone 返回的相关性顺序拼接。
        const contextParts: string[] = [];
        for (const [rank, match] of matches.entries()) {
            const documentChunk = rowsByDocumentId.get(match.id);
            if (!documentChunk) {
                console.warn(`未找到 Pinecone 记录对应的文档切片：${match.id}`);
                continue;
            }

            const source = match.metadata?.source;
            const score = typeof match.score === "number"
                ? match.score.toFixed(4)
                : "未知";

            contextParts.push([
                `[资料 ${rank + 1}]`,
                source ? `来源：${String(source)}` : null,
                `相关度：${score}`,
                documentChunk.content,
            ].filter((line): line is string => line !== null).join("\n"));
        }

        console.log(`检索命中 ${matches.length} 条，成功回查 ${contextParts.length} 个文档切片`);
        return {
            context: contextParts.join("\n\n---\n\n"),
        };
    } catch (error) {
        console.error("查询切片数据失败:", error);
        throw error;
    }
};
