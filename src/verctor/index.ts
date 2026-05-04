import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";

const pc = new Pinecone({
    apiKey: String(process.env.PINECONE_API_KEY),
})

export const index = pc.index(String(process.env.PINECONE_INDEX_NAME));
