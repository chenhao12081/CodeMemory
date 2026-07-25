import assert from "node:assert/strict";
import test from "node:test";
import {
    HASH_ID_PREFIX,
    STABLE_CHUNK_ID_LENGTH,
    createCorpusVersion,
    createStableChunkId,
} from "./identity.ts";

test("稳定 chunk ID 忽略换行、行尾空格和 Unicode 表示差异", () => {
    const first = createStableChunkId({
        source: "docs\\大模型.md",
        headings: { h1: "Cafe\u0301", h2: " RAG " },
        content: "第一行  \r\n第二行\r\n",
    });
    const second = createStableChunkId({
        source: "docs/大模型.md",
        headings: { h1: "Café", h2: "RAG" },
        content: "第一行\n第二行",
    });

    assert.equal(first, second);
    assert.equal(first.length, STABLE_CHUNK_ID_LENGTH);
    assert.ok(first.startsWith(HASH_ID_PREFIX));
});

test("正文、来源或标题变化时生成新的 chunk ID", () => {
    const base = {
        source: "大模型.md",
        headings: { h1: "RAG", h2: "检索" },
        content: "RAG 会先召回相关资料。",
    };
    const original = createStableChunkId(base);

    assert.notEqual(original, createStableChunkId({
        ...base,
        content: "RAG 会先召回并重排相关资料。",
    }));
    assert.notEqual(original, createStableChunkId({
        ...base,
        source: "另一份文档.md",
    }));
    assert.notEqual(original, createStableChunkId({
        ...base,
        headings: { ...base.headings, h2: "重排" },
    }));
});

test("corpusVersion 与 chunk 顺序和重复项无关", () => {
    const first = createStableChunkId({ source: "a.md", content: "A" });
    const second = createStableChunkId({ source: "b.md", content: "B" });

    assert.equal(
        createCorpusVersion([first, second]),
        createCorpusVersion([second, first, first]),
    );
});

test("语料成员变化时 corpusVersion 随之变化", () => {
    const first = createStableChunkId({ source: "a.md", content: "A" });
    const second = createStableChunkId({ source: "b.md", content: "B" });

    assert.notEqual(
        createCorpusVersion([first]),
        createCorpusVersion([first, second]),
    );
    assert.throws(() => createCorpusVersion([]), /至少需要一个有效的 chunk ID/);
});
