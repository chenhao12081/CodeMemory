import "dotenv/config";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";
import { Document } from "langchain";
import { Pinecone } from "@pinecone-database/pinecone";
import { saveChunksToDB } from "../tools/database.ts";
import type { DocumentChunk } from "../tools/database.ts";
// import { Ollama } from "ollama";
import ollama from "ollama";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pc = new Pinecone({
    apiKey: String(process.env.PINECONE_API_KEY),
})
const index = pc.index('my-rag-index');

function splitByMarkdownHeaders(content: string) {
    const chunks: Array<{ text: string; headers: Record<string, string>}> = [];
    
    // 按行分解，记录当前所在的 header层级
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
    // 第一步 获取所有 markdown
    const dirname = join(__dirname, "..", "static");
    const files = readdirSync(dirname).filter((f) => f.endsWith(".md"));
    console.log(`一个有${files.length}个Markdown文件`);

    const allChunks: Document[] = [];

    for (const file of files) {
        const filePath = join(dirname, file);
        const fileLoader = new TextLoader(filePath);
        const docs = await fileLoader.load();
        const rawContent = docs.map((d) => d.pageContent).join("\n\n");

        console.log(`\n📄 处理文件: ${file}`);
        console.log(`   原始长度: ${rawContent.length} 字符`);

        // 第二步 按 markdown headers （# ## ###） 进行结构化切片
        const headerChunks = splitByMarkdownHeaders(rawContent);
        console.log(`按#/##/### 切片得到 ${headerChunks.length} 个 chunk`);

        // 第三步：对过大的 chunk进一步使用 RecursiveCharacterTextSplitter切分
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            separators: ["\n\n", "\n", "。", "，", " ", ""],
        });

        for (const chunk of headerChunks) {
            if (chunk.text.length > 1200) {
                const subdocs = await textSplitter.createDocuments([chunk.text]);
                for (const subdoc of subdocs) {
                    subdoc.metadata = {
                        ...subdoc.metadata,
                        source: file,
                        category: inferCategory(file),
                        ...chunk.headers,
                    }
                    allChunks.push(subdoc);
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
    // console.log("\n--- 前 2 个 Chunk 示例 ---");
    for (let i = 0; i < Math.min(2, allChunks.length); i++) {
        const chunk = allChunks[i];
        // console.log(`\n[Chunk ${i + 1}]`);
        // console.log(`  元数据:`, JSON.stringify(chunk.metadata, null, 2));
        // console.log(`  内容预览: ${chunk.pageContent.slice(0, 150)}...`);
    }

    // embeddings是chunks完成向量化的结果
    const { total_duration, embeddings } = await ollama.embed({
        model: "bge-m3",
        input: allChunks.map((chunk) => chunk.pageContent),
    })
    console.log(`\n向量化完成，共获得${embeddings.length}个向量，耗时${(total_duration / 1e9)}s`);

    const documentChunks: DocumentChunk[] = allChunks.map((chunk, index) => ({
        document_id: `doc-${index}`,
        chunk_index: index,
        content: chunk.pageContent,
        metadata: chunk.metadata,
    }));

    await saveChunksToDB(documentChunks);
    // console.log('✅ 切片数据已保存到 MySQL 数据库！');

    const pcRecords = allChunks.map((chunk, index) => {
        const serializedMetadata: Record<string, string | number | boolean | string[]> = {
            chunk_index: index, // 与 MySQL document_chunks.chunk_index 一致，便于关联查询
        };
        for (const [key, value] of Object.entries(chunk.metadata)) {
            serializedMetadata[key] = typeof value === "object" && value !== null && !Array.isArray(value)
                ? JSON.stringify(value)
                : value;
        }
        return {
            id: `doc-${index}`,
            values: embeddings[index],
            metadata: serializedMetadata,
        };
    });
    // 分批上传，每批 100 条，避免单次请求过大
    const BATCH_SIZE = 100;
    for (let i = 0; i < pcRecords.length; i += BATCH_SIZE) {
        const batch = pcRecords.slice(i, i + BATCH_SIZE);
        await index.upsert({ records: batch });
        console.log(`✅ 已上传 ${Math.min(i + BATCH_SIZE, pcRecords.length)}/${pcRecords.length}`);
    }
    console.log('✅ 全部存入成功！');
}

main();