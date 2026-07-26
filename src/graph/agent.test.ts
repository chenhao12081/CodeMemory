import assert from "node:assert/strict";
import test from "node:test";
import {
    runAgent,
    type CodeMemoryAgent,
} from "./agent.ts";

function recordingAgent(threadIds: string[]): CodeMemoryAgent {
    return {
        invoke: async (
            input: { question: string },
            config: { configurable: { thread_id: string } },
        ) => {
            threadIds.push(config.configurable.thread_id);
            return {
                output: `answer:${input.question}`,
            };
        },
    } as unknown as CodeMemoryAgent;
}

test("每条样例默认使用不同的 thread_id", async () => {
    const threadIds: string[] = [];
    const agent = recordingAgent(threadIds);

    const first = await runAgent(agent, "问题一");
    const second = await runAgent(agent, "问题二");

    assert.equal(first.output, "answer:问题一");
    assert.equal(second.output, "answer:问题二");
    assert.notEqual(first.threadId, second.threadId);
    assert.deepEqual(threadIds, [first.threadId, second.threadId]);
    assert.match(first.threadId, /^[a-f0-9-]{36}$/);
    assert.match(second.threadId, /^[a-f0-9-]{36}$/);
});

test("显式 thread_id 可用于延续同一会话", async () => {
    const threadIds: string[] = [];
    const agent = recordingAgent(threadIds);

    const result = await runAgent(agent, "继续上一个问题", {
        threadId: "conversation-1",
    });

    assert.equal(result.threadId, "conversation-1");
    assert.deepEqual(threadIds, ["conversation-1"]);
});

test("拒绝空问题和空 thread_id", async () => {
    const agent = recordingAgent([]);

    await assert.rejects(() => runAgent(agent, "  "), /question 不能为空/);
    await assert.rejects(
        () => runAgent(agent, "问题", { threadId: "  " }),
        /threadId 不能为空字符串/,
    );
});
