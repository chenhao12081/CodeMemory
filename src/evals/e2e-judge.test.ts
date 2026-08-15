import assert from "node:assert/strict";
import test from "node:test";
import {
    judgeAnswer,
    judgePassed,
    parseAnswerJudgeResponse,
} from "./e2e-judge.ts";
import type { E2EEvalCase } from "./e2e-core.ts";

const ragCase: E2EEvalCase = {
    id: "rag",
    question: "为什么需要 overlap？",
    expectedBranch: "rag_answer",
    relevantChunkIds: [`sha256:${"1".repeat(64)}`],
    requiredFacts: ["保留上下文"],
    forbiddenClaims: [],
    criteria: [],
};

const validResponse = {
    scores: {
        correctness: 5,
        completeness: 4,
        relevance: 5,
        groundedness: 5,
        branchCompliance: 5,
    },
    missingFacts: [],
    unsupportedClaims: [],
    reason: "答案有依据",
};

test("解析代码块包裹的 Judge JSON", () => {
    const result = parseAnswerJudgeResponse(
        `\`\`\`json\n${JSON.stringify(validResponse)}\n\`\`\``,
    );

    assert.equal(result.scores.groundedness, 5);
});

test("RAG 存在无依据断言时不通过", () => {
    assert.equal(judgePassed("rag_answer", validResponse), true);
    assert.equal(judgePassed("rag_answer", {
        ...validResponse,
        unsupportedClaims: ["资料外断言"],
    }), false);
});

test("非 RAG 分支不要求 groundedness", () => {
    assert.equal(judgePassed("direct_chat", {
        ...validResponse,
        scores: {
            ...validResponse.scores,
            groundedness: null,
        },
    }), true);
});

test("Judge 首次格式错误后重试并返回确定性 passed", async () => {
    let calls = 0;
    const model = {
        async invoke() {
            calls += 1;
            return {
                content: calls === 1 ? "not-json" : JSON.stringify(validResponse),
            };
        },
    };

    const result = await judgeAnswer({
        testCase: ragCase,
        actualBranch: "rag_answer",
        answer: "重叠用于保留上下文",
        actualContext: "切片重叠可以保留上下文",
        goldContext: "切片重叠可以保留上下文",
    }, { model, maxAttempts: 2 });

    assert.equal(calls, 2);
    assert.equal(result.passed, true);
});
