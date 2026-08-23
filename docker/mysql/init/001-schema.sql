CREATE DATABASE IF NOT EXISTS codememory
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE codememory;

CREATE TABLE IF NOT EXISTS corpus_deployments (
    deployment_id VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    corpus_version VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS corpus_runtime_state (
    singleton_id TINYINT UNSIGNED NOT NULL,
    active_deployment_id VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NULL,
    previous_deployment_id VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (singleton_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO corpus_runtime_state (
    singleton_id, active_deployment_id, previous_deployment_id
) VALUES (1, NULL, NULL);

CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    deployment_id VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    document_id VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    chunk_index INT UNSIGNED NOT NULL,
    content LONGTEXT NOT NULL,
    metadata JSON NOT NULL,
    heading_text TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_document_chunks_deployment_document (deployment_id, document_id),
    KEY idx_document_chunks_deployment (deployment_id),
    KEY idx_document_chunks_chunk_index (chunk_index),
    FULLTEXT KEY ft_document_chunks_content_ngram (content) WITH PARSER ngram,
    FULLTEXT KEY ft_document_chunks_heading_ngram (heading_text) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
