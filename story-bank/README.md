# Story Bank

STAR interview stories, one per file, mined from real work artifacts.

## File naming

`YYYY-MM-short-slug.md` — the year-month the work happened, plus a short kebab-case slug.

## Format

```markdown
---
title: <punchy title, 8 words max>
date: <YYYY-MM or range the work happened>
tags: [tag1, tag2, tag3]        # 3-8 lowercase CV-vocabulary skill tags
source: evidence-miner          # how this story entered the bank
redacted: false                 # true if client/employer names were removed
---

## Situation
<context, scope, stakes>

## Task
<the specific goal the user personally owned>

## Action
<what the user personally did — "I" voice, concrete verbs, numbers where real>

## Result
<quantified outcome where a real number exists; honest without one. Never estimated.>

## Evidence
<citable artifacts: commit hashes, PR titles, dates, files, scale indicators —
so future-you can verify past-you. Business-impact numbers come from the user,
never inferred from code.>

## Coaching questions   (optional)
<up to 3 questions that would sharpen the story if answered>
```

## Groundedness rule

Every claim traces to an artifact or to a number the user supplied. Technical
facts come from git/PRs; business impact comes from the user. Nothing is
estimated, rounded, or sharpened on the user's behalf. A `<TODO: 待填>` marker
means a real number is expected but not yet supplied — never replace it with a guess.
