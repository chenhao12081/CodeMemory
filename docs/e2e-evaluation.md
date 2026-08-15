# E2E 分支与答案评测

`eval:e2e` 使用真实 LangGraph 链路评估意图路由、证据判定、最终分支和答案质量。
同一个 Agent 可在整批评测中复用，但 `runAgent` 会为每条样例生成独立
`thread_id`，避免 `MemorySaver` 状态串样。

## 三类分支

- `direct_chat`：无需知识库的聊天、翻译、改写或创作任务。
- `rag_answer`：知识库中存在足以回答问题的证据。
- `rag_fallback`：问题方向属于知识库范围，但实际资料不足，使用通用模型降级回答。

Agent 在最终状态中显式返回 `answerMode`，评测器不会通过答案文案猜测分支。

## Gold 数据

RAG 样例不要求维护完整标准答案：

```json
{
  "id": "rag-overlap",
  "question": "为什么切片需要 overlap？",
  "expectedBranch": "rag_answer",
  "relevantChunkIds": ["sha256:<gold chunk>"],
  "requiredFacts": [
    "避免语义在边界被截断"
  ]
}
```

- `relevantChunkIds` 是人工标注的 gold context，RAG 样例必填。
- `requiredFacts` 是可选评分点，不要求答案逐字匹配。
- `forbiddenClaims` 可用于明确禁止错误事实。
- `criteria` 用于 direct_chat 和 rag_fallback 的格式、风格或行为要求。

Judge 分开对照两类上下文：

- `actualContext`：Agent 本次真正看到的检索结果，用于判断忠实度。
- `goldContext`：人工标注的相关 chunk，用于判断正确性和完整性。

因此，即使模型忠实总结了错误召回的资料，也会在正确性上失败。

## 指标

- Intent Accuracy
- Evidence Decision Accuracy
- Final Branch Accuracy
- 每个分支的 Precision、Recall、F1 和混淆矩阵
- Judge correctness、completeness、relevance、groundedness、branchCompliance
- Judge Pass Rate
- Strict E2E Success Rate：最终分支正确且 Judge 通过
- Agent 与 Judge 的 mean、p50、p95 耗时

Agent 或 Judge 调用失败按失败样例保留在指标分母中。

## 运行

```bash
pnpm eval:e2e
```

使用其他数据集：

```bash
pnpm eval:e2e -- path/to/e2e-eval.json
```

常用环境变量：

```bash
E2E_JUDGE_MODEL=deepseek-v4-pro
E2E_JUDGE_MAX_ATTEMPTS=2
E2E_EVAL_LIMIT=3
E2E_EVAL_VALIDATE_ONLY=true
E2E_EVAL_RESULTS_DIR=eval-results/e2e
```

`E2E_EVAL_VALIDATE_ONLY=true` 只校验数据格式、语料版本和 gold chunk，不调用
Agent 或 Answer Judge。真实评测会将实际上下文和 gold context 交给配置的 Judge
模型，使用外部模型前应确认数据外发符合项目的安全要求。

完整报告保存在 `eval-results/e2e/e2e-eval-*.json`，其中包含数据集哈希、
Judge prompt 哈希、模型版本、逐题分支、答案、上下文、评分和错误。
