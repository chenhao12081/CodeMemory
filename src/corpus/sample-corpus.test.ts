import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { parseE2EDataset } from "../evals/e2e-core.ts";
import { parseRetrievalDataset } from "../evals/retrieval-core.ts";
import { createCorpusVersion, createStableChunkId } from "./identity.ts";

type MarkdownChunk = {
    content: string;
    headings: { h1?: string; h2?: string; h3?: string };
};

function splitSmallSampleDocument(content: string): MarkdownChunk[] {
    const chunks: MarkdownChunk[] = [];
    let h1 = "";
    let h2 = "";
    let h3 = "";
    let buffer: string[] = [];

    const flush = () => {
        const chunkContent = buffer.join("\n").trim();
        if (chunkContent) {
            assert.ok(
                chunkContent.length <= 1200,
                "示例文档出现需要递归切分的大段落，请同步更新示例评测标签",
            );
            chunks.push({
                content: chunkContent,
                headings: {
                    ...(h1 ? { h1 } : {}),
                    ...(h2 ? { h2 } : {}),
                    ...(h3 ? { h3 } : {}),
                },
            });
        }
        buffer = [];
    };

    for (const line of content.split("\n")) {
        const h1Match = line.match(/^#\s+(.+)/);
        const h2Match = line.match(/^##\s+(.+)/);
        const h3Match = line.match(/^###\s+(.+)/);
        if (h1Match) {
            flush();
            h1 = h1Match[1].trim();
            h2 = "";
            h3 = "";
        } else if (h2Match) {
            flush();
            h2 = h2Match[1].trim();
            h3 = "";
        } else if (h3Match) {
            flush();
            h3 = h3Match[1].trim();
        }
        buffer.push(line);
    }
    flush();
    return chunks;
}

test("公开示例语料与检索、E2E 评测标签保持同一 corpusVersion", () => {
    const repositoryRoot = process.cwd();
    const corpusDirectory = resolve(repositoryRoot, "examples/corpus");
    const chunkIds = readdirSync(corpusDirectory)
        .filter((file) => file.endsWith(".md"))
        .sort()
        .flatMap((file) => {
            const content = readFileSync(join(corpusDirectory, file), "utf8");
            return splitSmallSampleDocument(content).map((chunk) =>
                createStableChunkId({
                    source: file,
                    headings: chunk.headings,
                    content: chunk.content,
                }));
        });
    const corpusVersion = createCorpusVersion(chunkIds);
    const availableChunkIds = new Set(chunkIds);

    const retrieval = parseRetrievalDataset(readFileSync(
        resolve(repositoryRoot, "examples/eval/retrieval-eval.json"),
        "utf8",
    )).dataset;
    const e2e = parseE2EDataset(readFileSync(
        resolve(repositoryRoot, "examples/eval/e2e-eval.json"),
        "utf8",
    )).dataset;

    assert.equal(retrieval.corpusVersion, corpusVersion);
    assert.equal(e2e.corpusVersion, corpusVersion);
    for (const chunkId of [
        ...retrieval.cases.flatMap((testCase) => testCase.relevantChunkIds),
        ...e2e.cases.flatMap((testCase) => testCase.relevantChunkIds ?? []),
    ]) {
        assert.ok(availableChunkIds.has(chunkId), `示例评测引用了未知 chunk：${chunkId}`);
    }
});
