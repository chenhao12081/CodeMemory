import "dotenv/config";
import pool from "../database/db.ts";
import { createAgent, runAgent } from "./agent.ts";

async function main() {
    const question = process.argv.slice(2).join(" ").trim()
        || "介绍大模型的发展史";
    const agent = createAgent();
    const result = await runAgent(agent, question);

    console.log(result.output);
    console.log(`thread_id: ${result.threadId}`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}).finally(async () => {
    await pool.end();
});
