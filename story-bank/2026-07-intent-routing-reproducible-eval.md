---
title: Made RAG routing measurable with intent evals and stable corpus IDs
date: 2026-07
tags: [rag, intent-classification, routing, evaluation, reproducibility, content-hashing, dataset-design, typescript]
source: evidence-miner
redacted: false
---

## Situation
CodeMemory has to decide, per query, whether to answer from the knowledge base,
chat directly, or fall back to a general model when the topic is in scope but the
corpus lacks evidence. Early on this routing was untested, and a subtler problem
lurked underneath: chunk ids weren't stable, so every time I rebuilt the corpus
the ids shifted — which would silently invalidate any evaluation labels that
pointed at specific chunks.

## Task
I owned making both the routing and the retrieval reproducibly measurable:
routing needed a labelled dataset and an accuracy number, and the corpus needed
an identity stable enough that a gold-labelled evaluation set stays valid across
rebuilds.

## Action
For routing, I wrote an explicit routing policy (`intent-policy.ts`) and built a
dataset programmatically with a generator (`generate-intent-dataset.ts`, 184
lines), producing a 1,400-example training set and a 350-example validation set
as JSONL, plus an intent evaluation script that scores routing accuracy and saves
reports. I iterated on the policy and training data together so the labels and
the routing rules stayed aligned rather than drifting apart. For reproducibility,
I gave every chunk a stable content-hash identity: `corpus/identity.ts` canonicalizes
text (NFC normalization, newline unification, trailing-whitespace trimming) and
derives a `sha256:`-prefixed id, versioned with a schema number and covered by
unit tests. I then wired a corpus-version check into the evaluators so a run
aborts up front if the dataset's `corpusVersion` doesn't match the live MySQL
corpus or if any gold chunk id is missing — turning a silent correctness bug into
a loud pre-flight failure.

## Result
I turned routing from untested behavior into a scored, dataset-backed component,
and made corpus-dependent evaluation reproducible: gold labels now survive corpus
rebuilds, and stale evaluation sets fail fast instead of reporting misleading
numbers.

- Intent routing accuracy from `pnpm eval` (Intent Accuracy, and before/after
  policy alignment if you have it): <TODO: 待填>

## Evidence
- Intent routing + evals:
  - `1cfb788` (2026-07-11, Add intent evaluation script).
  - `319f0fd` (2026-07-13, Expand intent evaluation dataset).
  - `b5eb6a3` (2026-07-14, Align intent routing policy and training data) —
    `intent-policy.ts`, `generate-intent-dataset.ts` (184 lines),
    `intent-train.jsonl` (1,400 examples), `intent-validation.jsonl` (350 examples).
  - `f9dc9c8` (2026-07-17, Save intent evaluation reports and export training text)
    — exported 5,599-line `intent-train.txt`, evaluation reports. (Large +LOC here
    is dataset/report text, not code.)
- Stable corpus identity + safe rebuild:
  - `2aaab61` (2026-07-25, feat: add stable corpus identity) — `src/corpus/identity.ts`
    (SHA-256 content hashing, NFC canonicalization, schema versioning) +
    `identity.test.ts`.
  - `6a9a91d` (2026-07-26, feat: add retrieval diagnostics and safe corpus rebuild)
    — 8 files.
  - Corpus-version pre-flight validation described in `docs/retrieval-evaluation.md`
    and `docs/e2e-evaluation.md` (validate-only mode checks corpusVersion + gold ids).
- Solo project; `gh` not installed, so evidence is commits + files, no PRs.

## Coaching questions
1. What routing accuracy did you reach, and did aligning policy-with-data move it?
2. Had a corpus rebuild already burned you (invalidated labels) before you built
   stable ids — or did you design it defensively before it bit you?
