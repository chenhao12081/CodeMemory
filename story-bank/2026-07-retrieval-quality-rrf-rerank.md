---
title: Lifted RAG retrieval quality with RRF fusion and cross-encoder reranking
date: 2026-07
tags: [rag, information-retrieval, reciprocal-rank-fusion, cross-encoder, reranking, typescript, evaluation, latency]
source: evidence-miner
redacted: false
---

## Situation
I was building CodeMemory, a personal RAG knowledge base that answers technical
questions over a corpus of Chinese engineering documents. The first version
retrieved with a single dense channel (Pinecone vector search) and passed the
raw top-K straight to the answer model. Recall was fragile: questions whose
wording didn't match the passage embedding — especially ones better served by an
exact heading or body-text match — were missing the right chunk entirely.

## Task
I owned improving retrieval quality end to end without making the pipeline
un-measurable: every change had to be comparable on the same recall set so I
could prove an improvement rather than assume one.

## Action
I rebuilt retrieval as a multi-channel system in two stages. First I added three
parallel recall channels — dense (Pinecone), body-text full-text, and heading
full-text — and fused them with a weighted Reciprocal Rank Fusion I wrote from
scratch (`weightedReciprocalRankFusion`), deduplicating candidates within a
channel so no document double-counts, and breaking score ties deterministically
by document id. I ran the three channels concurrently with `Promise.all` in a
channel runner that records per-channel latency via `performance.now()` and
isolates failures so one dead channel can't sink the whole recall. Second, I
layered a cross-encoder reranker on top using a `@huggingface/transformers`
sequence-classification model, with a numerically stable sigmoid and a warm-up
pass so first-load time never pollutes steady-state latency. Both the fusion and
the reranker ship with their own unit tests.

## Result
I turned a single-signal retriever into a three-channel fused-and-reranked
pipeline with three head-to-head strategies measurable on one recall pass:
`dense-only`, `three-way-rrf`, and `three-way-rrf-rerank`.

- Retrieval quality (HitRate@K / Recall@K / MRR@K / nDCG@K), dense-only → +RRF → +rerank: <TODO: 待填 — 你的 pnpm eval:retrieval 对比数字>
- Added latency cost of reranking (mean / p50 / p95): <TODO: 待填>

## Evidence
- `3fdee35` (2026-07-23, feat: add multi-channel retrieval with RRF) — 13 files, +539/-70.
  Added `src/retrieval/fusion.ts` (weighted RRF) + `fusion.test.ts` (49 lines),
  `channel-runner.ts`, `dense-retriever.ts`, `mysql-retrievers.ts`,
  `retrieval-service.ts`, `context-builder.ts`, and full-text indexes in
  `src/database/setup-retrieval-indexes.ts`.
- `d6f006c` (2026-07-24, feat: add cross-encoder reranking) — 9 files, +976/-10.
  Added `src/retrieval/reranker.ts` (@huggingface/transformers sequence
  classification, stable sigmoid, warm-up) + `reranker.test.ts`.
- `1f43310` (2026-07-19, feat: combine top matching RAG chunks) — earlier step
  toward combining multiple chunks into answer context.
- Strategy comparison documented in `docs/retrieval-evaluation.md`; metrics
  implemented in `src/evals/retrieval-core.ts:163-215` (HitRate, Recall, MRR, nDCG).
- Solo project; `gh` not installed, so evidence is commits + files, no PRs.

## Coaching questions
1. What were the actual before/after numbers, and which metric moved most?
2. Was the latency cost of reranking acceptable for your use case — did you cap
   candidate count to control it?
3. Why weighted RRF specifically rather than a learned fusion — what made the
   simple, tunable approach the right call here?
