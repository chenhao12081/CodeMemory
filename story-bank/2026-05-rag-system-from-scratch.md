---
title: Built a RAG knowledge base from scratch on LangGraph
date: 2026-05 – 2026-07
tags: [rag, langgraph, pinecone, mysql, vector-search, typescript, system-design, embeddings]
source: evidence-miner
redacted: false
---

## Situation
I wanted a knowledge base that could answer technical questions over a corpus of
Chinese engineering documents, so I started CodeMemory from an empty repository.
There was no existing pipeline — ingestion, storage, retrieval, and routing all
had to be designed and built.

## Task
I owned the whole system end to end: turn raw markdown documents into something a
model could retrieve against and answer from, with a clean enough architecture
that I could later swap models and upgrade retrieval without a rewrite.

## Action
I built the ingestion pipeline first — a markdown chunker (`split.ts`, ~196 lines)
that splits documents into heading-aware chunks, an embedding step, and upload to
Pinecone for dense vector search. I then added a MySQL layer to persist chunks and
support retrieval alongside the vector index, so the corpus had a durable,
queryable home rather than living only in the vector store. On top of retrieval I
added a LangGraph router node with structured output to decide how each query
should be handled. As the system matured I kept the concerns cleanly separated
into `src/graph/` (orchestration), `src/retrieval/` (recall + fusion + rerank),
`src/corpus/` (identity), and `src/evals/` (measurement) — which is exactly what
let me later drop in DeepSeek V4 for answers and a local Ollama Qwen model for
routing without disturbing the rest.

## Result
I went from an empty repo to a working, layered RAG system in the first days of
the project, and that architecture held up across three months of upgrades
(multi-channel retrieval, reranking, evidence validation, evaluation harnesses)
without a structural rewrite — 40+ TypeScript source files organized by concern.

- Corpus scale actually indexed (documents / chunks) and any usage numbers:
  <TODO: 待填 — 只有你知道的规模数字>

## Evidence
- `092b8dc` (2026-05-02, Initial commit).
- `017b2c6` (2026-05-04, Add markdown chunking, embedding, and Pinecone upload
  pipeline) — added `src/graph/split.ts` (196 lines), ingestion pipeline,
  `src/graph/index.ts`. (Large +LOC in this commit is mostly the pnpm lockfile
  and a vendored markdown corpus, not hand-written code.)
- `98fef52` (2026-05-04, Add MySQL chunk storage and retrieval pipeline with
  vector search).
- `f8dd25c` (2026-05-04, Add router node with structured output, fix Pinecone
  query and module resolution).
- `eabd870` (2026-07-10, Use Ollama Qwen model) and `ef5b068` (2026-07-19,
  feat: use DeepSeek V4 for chat responses) — model swaps enabled by the layering.
- Current tree: `src/graph/`, `src/retrieval/`, `src/corpus/`, `src/evals/`.
- Solo project; `gh` not installed, so evidence is commits + files, no PRs.

## Coaching questions
1. How big is the corpus you actually index, and what's it used for day to day?
2. What was the hardest design decision in the first version — chunking strategy,
   the dual Pinecone+MySQL store, or the router — and why did you choose as you did?
