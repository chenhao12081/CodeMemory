CREATE DATABASE IF NOT EXISTS codememory
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE codememory;

CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    document_id VARCHAR(71) NOT NULL,
    chunk_index INT UNSIGNED NOT NULL,
    content LONGTEXT NOT NULL,
    metadata JSON NOT NULL,
    heading_text TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_document_chunks_document_id (document_id),
    KEY idx_document_chunks_chunk_index (chunk_index),
    FULLTEXT KEY ft_document_chunks_content_ngram (content) WITH PARSER ngram,
    FULLTEXT KEY ft_document_chunks_heading_ngram (heading_text) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
