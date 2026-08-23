import assert from "node:assert/strict";
import test from "node:test";
import {
    createCorpusDeploymentId,
    pineconeNamespaceForDeployment,
} from "./deployment.ts";

const corpusVersion = `sha256:${"a".repeat(64)}`;

test("deployment ID 对相同语料、模型与切片配置保持稳定", () => {
    const first = createCorpusDeploymentId({
        corpusVersion,
        embeddingModel: "bge-m3",
    });
    const second = createCorpusDeploymentId({
        corpusVersion: `  ${corpusVersion}  `,
        embeddingModel: " bge-m3 ",
    });

    assert.equal(first, second);
    assert.match(first, /^sha256:[a-f0-9]{64}$/);
    assert.equal(pineconeNamespaceForDeployment(first), `cm-${first.slice(7)}`);
});

test("同一 corpusVersion 更换 embedding 模型会产生新 deployment", () => {
    assert.notEqual(
        createCorpusDeploymentId({ corpusVersion, embeddingModel: "bge-m3" }),
        createCorpusDeploymentId({ corpusVersion, embeddingModel: "nomic-embed-text" }),
    );
});

test("非法 deployment ID 不能映射为 namespace", () => {
    assert.throws(
        () => pineconeNamespaceForDeployment("latest"),
        /格式无效/,
    );
});
