import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "../database/db.ts";

export type CorpusDeploymentStatus =
    | "building"
    | "ready"
    | "active"
    | "retired"
    | "failed"
    | "deleting";

export type CorpusDeployment = {
    deploymentId: string;
    corpusVersion: string;
    pineconeNamespace: string;
    status: CorpusDeploymentStatus;
    chunkCount: number;
    embeddingModel: string;
    errorMessage: string | null;
    createdAt: Date;
    readyAt: Date | null;
    activatedAt: Date | null;
    retiredAt: Date | null;
};

interface DeploymentRow extends RowDataPacket {
    deployment_id: string;
    corpus_version: string;
    pinecone_namespace: string;
    status: CorpusDeploymentStatus;
    chunk_count: number | string;
    embedding_model: string;
    error_message: string | null;
    created_at: Date;
    ready_at: Date | null;
    activated_at: Date | null;
    retired_at: Date | null;
}

interface RuntimeStateRow extends RowDataPacket {
    active_deployment_id: string | null;
    previous_deployment_id: string | null;
}

interface CountRow extends RowDataPacket {
    chunk_count: number | string;
    distinct_chunk_count: number | string;
}

interface DocumentIdRow extends RowDataPacket {
    document_id: string;
}

function mapDeployment(row: DeploymentRow): CorpusDeployment {
    return {
        deploymentId: row.deployment_id,
        corpusVersion: row.corpus_version,
        pineconeNamespace: row.pinecone_namespace,
        status: row.status,
        chunkCount: Number(row.chunk_count),
        embeddingModel: row.embedding_model,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        readyAt: row.ready_at,
        activatedAt: row.activated_at,
        retiredAt: row.retired_at,
    };
}

const DEPLOYMENT_COLUMN_NAMES = [
    "deployment_id",
    "corpus_version",
    "pinecone_namespace",
    "status",
    "chunk_count",
    "embedding_model",
    "error_message",
    "created_at",
    "ready_at",
    "activated_at",
    "retired_at",
] as const;
const DEPLOYMENT_COLUMNS = DEPLOYMENT_COLUMN_NAMES.join(", ");
const QUALIFIED_DEPLOYMENT_COLUMNS = DEPLOYMENT_COLUMN_NAMES
    .map((column) => `cd.${column}`)
    .join(", ");

function registrySetupError(error: unknown): Error {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR") {
        return new Error(
            "语料版本表尚未初始化，请先运行 pnpm setup:retrieval-indexes",
            { cause: error },
        );
    }
    return error instanceof Error ? error : new Error(String(error));
}

export async function getActiveCorpusDeployment(): Promise<CorpusDeployment> {
    try {
        const [rows] = await pool.query<DeploymentRow[]>(`
            SELECT ${QUALIFIED_DEPLOYMENT_COLUMNS}
            FROM corpus_runtime_state crs
            INNER JOIN corpus_deployments cd
                ON cd.deployment_id = crs.active_deployment_id
            WHERE crs.singleton_id = 1
            LIMIT 1
        `);
        if (!rows[0]) {
            throw new Error(
                "当前没有活动语料版本，请先运行 pnpm corpus:rebuild 或激活一个 ready 版本",
            );
        }
        return mapDeployment(rows[0]);
    } catch (error) {
        throw registrySetupError(error);
    }
}

export async function getCorpusDeployment(
    deploymentId: string,
): Promise<CorpusDeployment | undefined> {
    const [rows] = await pool.query<DeploymentRow[]>(`
        SELECT ${DEPLOYMENT_COLUMNS}
        FROM corpus_deployments
        WHERE deployment_id = ?
        LIMIT 1
    `, [deploymentId]);
    return rows[0] ? mapDeployment(rows[0]) : undefined;
}

export async function listCorpusDeployments(): Promise<CorpusDeployment[]> {
    try {
        const [rows] = await pool.query<DeploymentRow[]>(`
            SELECT ${DEPLOYMENT_COLUMNS}
            FROM corpus_deployments
            ORDER BY created_at DESC, deployment_id DESC
        `);
        return rows.map(mapDeployment);
    } catch (error) {
        throw registrySetupError(error);
    }
}

export async function beginCorpusDeployment(input: {
    deploymentId: string;
    corpusVersion: string;
    pineconeNamespace: string;
    embeddingModel: string;
}): Promise<void> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [stateRows] = await connection.query<RuntimeStateRow[]>(`
            SELECT active_deployment_id, previous_deployment_id
            FROM corpus_runtime_state
            WHERE singleton_id = 1
            FOR UPDATE
        `);
        if (!stateRows[0]) {
            throw new Error("corpus_runtime_state 未初始化，请先运行 pnpm setup:retrieval-indexes");
        }
        if (stateRows[0].active_deployment_id === input.deploymentId) {
            throw new Error(`deployment ${input.deploymentId} 已是活动版本，拒绝覆盖`);
        }
        if (stateRows[0].previous_deployment_id === input.deploymentId) {
            throw new Error(
                `deployment ${input.deploymentId} 是当前回滚版本，拒绝原地覆盖；`
                + "请直接激活它，或先明确清理后再重建",
            );
        }
        const [existingRows] = await connection.query<DeploymentRow[]>(`
            SELECT ${DEPLOYMENT_COLUMNS}
            FROM corpus_deployments
            WHERE deployment_id = ?
            FOR UPDATE
        `, [input.deploymentId]);
        if (existingRows[0]?.status === "deleting") {
            throw new Error(`deployment ${input.deploymentId} 正在清理，不能同时重建`);
        }

        await connection.query<ResultSetHeader>(`
            INSERT INTO corpus_deployments (
                deployment_id,
                corpus_version,
                pinecone_namespace,
                status,
                chunk_count,
                embedding_model,
                error_message,
                ready_at,
                activated_at,
                retired_at
            ) VALUES (?, ?, ?, 'building', 0, ?, NULL, NULL, NULL, NULL)
            ON DUPLICATE KEY UPDATE
                corpus_version = VALUES(corpus_version),
                pinecone_namespace = VALUES(pinecone_namespace),
                status = 'building',
                chunk_count = 0,
                embedding_model = VALUES(embedding_model),
                error_message = NULL,
                ready_at = NULL,
                activated_at = NULL,
                retired_at = NULL
        `, [
            input.deploymentId,
            input.corpusVersion,
            input.pineconeNamespace,
            input.embeddingModel,
        ]);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw registrySetupError(error);
    } finally {
        connection.release();
    }
}

export async function validateDeploymentChunks(
    deploymentId: string,
    expectedDocumentIds: readonly string[],
): Promise<void> {
    const [countRows] = await pool.query<CountRow[]>(`
        SELECT
            COUNT(*) AS chunk_count,
            COUNT(DISTINCT document_id) AS distinct_chunk_count
        FROM document_chunks
        WHERE deployment_id = ?
    `, [deploymentId]);
    const actualCount = Number(countRows[0]?.chunk_count ?? 0);
    const distinctCount = Number(countRows[0]?.distinct_chunk_count ?? 0);
    if (actualCount !== expectedDocumentIds.length || distinctCount !== expectedDocumentIds.length) {
        throw new Error(
            `MySQL 版本校验失败：expected=${expectedDocumentIds.length}, `
            + `actual=${actualCount}, distinct=${distinctCount}`,
        );
    }

    const expectedIdSet = new Set(expectedDocumentIds);
    if (expectedIdSet.size !== expectedDocumentIds.length) {
        throw new Error("MySQL 版本校验失败：期望的 chunk ID 存在重复项");
    }
    const [documentIdRows] = await pool.query<DocumentIdRow[]>(`
        SELECT document_id
        FROM document_chunks
        WHERE deployment_id = ?
    `, [deploymentId]);
    const actualIdSet = new Set(documentIdRows.map((row) => row.document_id));
    const missingId = expectedDocumentIds.find((documentId) => !actualIdSet.has(documentId));
    if (missingId) {
        throw new Error(`MySQL 版本校验失败，缺少 chunk：${missingId}`);
    }
}

export async function markCorpusDeploymentReady(
    deploymentId: string,
    chunkCount: number,
): Promise<void> {
    const [result] = await pool.query<ResultSetHeader>(`
        UPDATE corpus_deployments
        SET status = 'ready',
            chunk_count = ?,
            error_message = NULL,
            ready_at = CURRENT_TIMESTAMP
        WHERE deployment_id = ?
          AND status = 'building'
    `, [chunkCount, deploymentId]);
    if (result.affectedRows !== 1) {
        throw new Error(`无法将 deployment ${deploymentId} 标记为 ready`);
    }
}

export async function markCorpusDeploymentFailed(
    deploymentId: string,
    error: unknown,
): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query<ResultSetHeader>(`
        UPDATE corpus_deployments
        SET status = 'failed', error_message = ?
        WHERE deployment_id = ?
          AND status <> 'active'
    `, [message.slice(0, 4000), deploymentId]);
}

export async function activateCorpusDeployment(
    deploymentId: string,
    expectedCurrentDeploymentId?: string | null,
): Promise<{ active: CorpusDeployment; previousDeploymentId: string | null }> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [stateRows] = await connection.query<RuntimeStateRow[]>(`
            SELECT active_deployment_id, previous_deployment_id
            FROM corpus_runtime_state
            WHERE singleton_id = 1
            FOR UPDATE
        `);
        if (!stateRows[0]) {
            throw new Error("corpus_runtime_state 未初始化");
        }
        if (
            expectedCurrentDeploymentId !== undefined
            && stateRows[0].active_deployment_id !== expectedCurrentDeploymentId
        ) {
            throw new Error(
                "活动 deployment 在操作期间已变化，已拒绝过期的切换请求",
            );
        }
        const [targetRows] = await connection.query<DeploymentRow[]>(`
            SELECT ${DEPLOYMENT_COLUMNS}
            FROM corpus_deployments
            WHERE deployment_id = ?
            FOR UPDATE
        `, [deploymentId]);
        const target = targetRows[0];
        if (!target) {
            throw new Error(`找不到 deployment：${deploymentId}`);
        }
        if (!(["ready", "retired", "active"] as CorpusDeploymentStatus[]).includes(target.status)) {
            throw new Error(`deployment ${deploymentId} 状态为 ${target.status}，不能激活`);
        }

        const currentId = stateRows[0].active_deployment_id;
        if (currentId === deploymentId) {
            await connection.commit();
            return { active: mapDeployment(target), previousDeploymentId: stateRows[0].previous_deployment_id };
        }
        if (currentId) {
            await connection.query<ResultSetHeader>(`
                UPDATE corpus_deployments
                SET status = 'retired', retired_at = CURRENT_TIMESTAMP
                WHERE deployment_id = ?
            `, [currentId]);
        }
        await connection.query<ResultSetHeader>(`
            UPDATE corpus_deployments
            SET status = 'active',
                activated_at = CURRENT_TIMESTAMP,
                retired_at = NULL,
                error_message = NULL
            WHERE deployment_id = ?
        `, [deploymentId]);
        await connection.query<ResultSetHeader>(`
            UPDATE corpus_runtime_state
            SET active_deployment_id = ?,
                previous_deployment_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE singleton_id = 1
        `, [deploymentId, currentId]);
        await connection.commit();

        const active = await getCorpusDeployment(deploymentId);
        if (!active) {
            throw new Error(`激活后无法读取 deployment：${deploymentId}`);
        }
        return { active, previousDeploymentId: currentId };
    } catch (error) {
        await connection.rollback();
        throw registrySetupError(error);
    } finally {
        connection.release();
    }
}

export async function rollbackCorpusDeployment(): Promise<{
    active: CorpusDeployment;
    previousDeploymentId: string | null;
}> {
    const [rows] = await pool.query<RuntimeStateRow[]>(`
        SELECT active_deployment_id, previous_deployment_id
        FROM corpus_runtime_state
        WHERE singleton_id = 1
    `);
    const previousId = rows[0]?.previous_deployment_id;
    if (!previousId) {
        throw new Error("没有可回滚的 previous deployment");
    }
    return activateCorpusDeployment(previousId, rows[0].active_deployment_id);
}

export async function beginCorpusDeploymentCleanup(
    deploymentId: string,
): Promise<CorpusDeployment> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [stateRows] = await connection.query<RuntimeStateRow[]>(`
            SELECT active_deployment_id, previous_deployment_id
            FROM corpus_runtime_state
            WHERE singleton_id = 1
            FOR UPDATE
        `);
        if (stateRows[0]?.active_deployment_id === deploymentId) {
            throw new Error(`不能清理活动 deployment：${deploymentId}`);
        }
        const [deploymentRows] = await connection.query<DeploymentRow[]>(`
            SELECT ${DEPLOYMENT_COLUMNS}
            FROM corpus_deployments
            WHERE deployment_id = ?
            FOR UPDATE
        `, [deploymentId]);
        if (!deploymentRows[0]) {
            throw new Error(`找不到 deployment：${deploymentId}`);
        }
        await connection.query<ResultSetHeader>(`
            UPDATE corpus_deployments
            SET status = 'deleting'
            WHERE deployment_id = ?
        `, [deploymentId]);
        if (stateRows[0]?.previous_deployment_id === deploymentId) {
            await connection.query<ResultSetHeader>(`
                UPDATE corpus_runtime_state
                SET previous_deployment_id = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE singleton_id = 1
            `);
        }
        await connection.commit();
        return mapDeployment(deploymentRows[0]);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function finishCorpusDeploymentCleanup(deploymentId: string): Promise<void> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query<ResultSetHeader>(`
            DELETE FROM document_chunks WHERE deployment_id = ?
        `, [deploymentId]);
        const [result] = await connection.query<ResultSetHeader>(`
            DELETE FROM corpus_deployments
            WHERE deployment_id = ? AND status = 'deleting'
        `, [deploymentId]);
        if (result.affectedRows !== 1) {
            throw new Error(`deployment ${deploymentId} 未处于 deleting 状态`);
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function restoreCorpusDeploymentAfterCleanupFailure(
    deploymentId: string,
    error: unknown,
): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query<ResultSetHeader>(`
        UPDATE corpus_deployments
        SET status = 'failed', error_message = ?
        WHERE deployment_id = ? AND status = 'deleting'
    `, [`清理失败：${message}`.slice(0, 4000), deploymentId]);
}
