# 检索评测

`eval:retrieval` 在同一批召回结果上比较三种策略：

1. `dense-only`：只使用 Pinecone 稠密召回的原始排序。
2. `three-way-rrf`：稠密、正文全文、标题全文三路召回，经加权 RRF 融合。
3. `three-way-rrf-rerank`：三路召回和 RRF 后，再使用 Cross-Encoder 重排。

这样每个问题只执行一次三路召回，避免重复调用造成候选和耗时不可比。质量指标包括
HitRate@K、Recall@K、MRR@K 和二元相关性的 nDCG@K；失败样例按零分计入。
耗时指标包括 mean、p50 和 p95。

## 准备评测集

复制模板：

```bash
cp src/data/retrieval-eval.example.json src/data/retrieval-eval.json
```

评测集需要人工标注，每个问题至少提供一个相关的稳定 chunk ID：

```json
{
  "schemaVersion": 1,
  "corpusVersion": "sha256:<当前语料版本>",
  "cases": [
    {
      "id": "唯一问题 ID",
      "question": "用户真实问题",
      "relevantChunkIds": [
        "sha256:<相关 chunk ID>"
      ]
    }
  ]
}
```

同一个问题可以标注多个相关 chunk。评测器会在运行前检查：

- `corpusVersion` 与 MySQL 当前语料一致；
- 所有相关 ID 都是稳定 `sha256:*` ID；
- 所有相关 ID 都存在于当前 MySQL 语料；
- 最大评测 K 不超过重排候选数。

不要使用待评模型自动生成最终相关性标注，否则会引入评测偏差。可以先由模型生成候选，
再由人工确认相关 chunk。

## 运行

```bash
pnpm eval:retrieval
```

也可以传入其他数据集：

```bash
pnpm eval:retrieval -- path/to/retrieval-eval.json
```

默认评测 `K=1,3,5,10`，可通过环境变量修改：

```bash
RETRIEVAL_EVAL_KS=1,5,10 pnpm eval:retrieval
```

默认先执行一次不计入指标的预热，避免模型首次加载时间污染稳态耗时。如需测量冷启动，
设置 `RETRIEVAL_EVAL_WARMUP=false`。

终端打印策略对比表，完整逐题排名和错误信息写入
`eval-results/retrieval/retrieval-eval-*.json`。
