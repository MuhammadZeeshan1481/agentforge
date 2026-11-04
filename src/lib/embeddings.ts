import "server-only";
import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";

export const EMBEDDING_DIMS = 768;
const model = google.textEmbedding("gemini-embedding-001");

export async function embedDocuments(values: string[]) {
  const out: number[][] = [];
  for (let i = 0; i < values.length; i += 50) {
    const { embeddings } = await embedMany({
      model,
      values: values.slice(i, i + 50),
      maxRetries: 3,
      providerOptions: { google: { outputDimensionality: EMBEDDING_DIMS, taskType: "RETRIEVAL_DOCUMENT" } },
    });
    out.push(...embeddings);
  }
  return out;
}

export async function embedQuery(value: string) {
  const { embedding } = await embed({
    model,
    value,
    maxRetries: 2,
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIMS, taskType: "RETRIEVAL_QUERY" } },
  });
  return embedding;
}

/** pgvector literal */
export const toVector = (v: number[]) => `[${v.join(",")}]`;
