import "dotenv/config";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { OllamaEmbeddings } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";
import { Document } from "langchain";
import { readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 根据 Markdown headers (##, ###) 进行结构化切片
 *
 * 对于给定的 Markdown 内容，按照 ## 和 ### 进行层级切片，
 * 保留每个 chunk 的层级结构信息。
 */
function splitByMarkdownHeaders(
  content: string,
): Array<{ text: string; headers: Record<string, string> }> {
  const chunks: Array<{ text: string; headers: Record<string, string> }> = [];

  // 按行解析，记录当前所在的 header 层级
  const lines = content.split("\n");
  let currentH1 = "";
  let currentH2 = "";
  let currentH3 = "";
  let buffer: string[] = [];

  function flush() {
    const text = buffer.join("\n").trim();
    if (text.length > 0) {
      const headers: Record<string, string> = {};
      if (currentH1) headers["h1"] = currentH1;
      if (currentH2) headers["h2"] = currentH2;
      if (currentH3) headers["h3"] = currentH3;
      chunks.push({ text, headers });
    }
    buffer = [];
  }

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);

    if (h1Match) {
      flush();
      currentH1 = h1Match[1].trim();
      currentH2 = "";
      currentH3 = "";
    } else if (h2Match) {
      flush();
      currentH2 = h2Match[1].trim();
      currentH3 = "";
    } else if (h3Match) {
      flush();
      currentH3 = h3Match[1].trim();
    }

    buffer.push(line);
  }

  flush(); // 处理最后一部分
  return chunks;
}

/**
 * 根据文件名自动推断分类标签
 */
function inferCategory(filename: string): string {
  const name = basename(filename, ".md").toLowerCase();
  const categoryMap: Record<string, string> = {
    webpack: "frontend",
    react: "frontend",
    vue: "frontend",
    javascript: "frontend",
    typescript: "frontend",
    css: "frontend",
    html: "frontend",
    node: "backend",
    python: "backend",
    java: "backend",
    go: "backend",
    rust: "backend",
    sql: "database",
    mongodb: "database",
    redis: "database",
    docker: "devops",
    kubernetes: "devops",
    linux: "devops",
    git: "devops",
    ai: "ai",
    llm: "ai",
    大模型: "ai",
    machine: "ai",
    deep: "ai",
    transformer: "ai",
    prompt: "ai",
  };

  for (const [key, category] of Object.entries(categoryMap)) {
    if (name.includes(key)) return category;
  }
  return "general";
}

async function main() {
  const staticDir = join(__dirname, "..", "static");
  const files = readdirSync(staticDir).filter((f) => f.endsWith(".md"));
  console.log(`发现 ${files.length} 个 Markdown 文件:`, files);

  // 第一步：加载所有 Markdown 文件
  let allChunks: Document[] = [];

  for (const file of files) {
    const filePath = join(staticDir, file);
    const loader = new TextLoader(filePath);
    const docs = await loader.load();
    const rawContent = docs.map((d) => d.pageContent).join("\n\n");

    console.log(`\n📄 处理文件: ${file}`);
    console.log(`   原始长度: ${rawContent.length} 字符`);

    // 第二步：按 Markdown headers (##, ###) 进行结构化切片
    const headerChunks = splitByMarkdownHeaders(rawContent);
    console.log(`   按 ##/### 切片得到 ${headerChunks.length} 个 chunk`);

    // 第三步：对过大的 chunk 进一步用 RecursiveCharacterTextSplitter 切分
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", "。", "，", " ", ""],
    });

    for (const chunk of headerChunks) {
      if (chunk.text.length > 1200) {
        const subDocs = await textSplitter.createDocuments([chunk.text]);
        for (const subDoc of subDocs) {
          subDoc.metadata = {
            ...subDoc.metadata,
            source: file,
            category: inferCategory(file),
            ...chunk.headers,
          };
          allChunks.push(subDoc);
        }
      } else {
        allChunks.push(
          new Document({
            pageContent: chunk.text,
            metadata: {
              source: file,
              category: inferCategory(file),
              ...chunk.headers,
            },
          }),
        );
      }
    }
  }

  console.log(`\n📊 总计生成 ${allChunks.length} 个最终 chunk`);

  // 展示前 3 个 chunk 的内容和元数据
  console.log("\n--- 前 3 个 Chunk 示例 ---");
  for (let i = 0; i < Math.min(3, allChunks.length); i++) {
    const chunk = allChunks[i];
    console.log(`\n[Chunk ${i + 1}]`);
    console.log(`  元数据:`, JSON.stringify(chunk.metadata, null, 2));
    console.log(`  内容预览: ${chunk.pageContent.slice(0, 150)}...`);
  }

  // 第四步：向量化入库 (MemoryVectorStore) - 使用 Ollama 本地 bge-m3 模型
  console.log("\n🔢 开始向量化入库 (Ollama bge-m3)...");
  const embeddings = new OllamaEmbeddings({
    model: "bge-m3",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  });

  const vectorStore = await MemoryVectorStore.fromDocuments(
    allChunks,
    embeddings,
  );
  console.log("✅ 向量化入库完成！");

  // 第五步：验证检索
  console.log("\n🔍 测试相似性检索...");
  const testQueries = [
    "webpack的loader是什么",
    "transformer的自注意力机制",
  ];

  for (const query of testQueries) {
    console.log(`\n查询: "${query}"`);
    const results = await vectorStore.similaritySearch(query, 2);
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      console.log(
        `  结果 ${i + 1}: [${r.metadata.source}] ${r.pageContent.slice(0, 100)}...`,
      );
    }
  }

  return vectorStore;
}

main().catch(console.error);
