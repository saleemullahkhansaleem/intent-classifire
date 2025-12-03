
// src/embed.js
import OpenAI from "openai";

export const client = new OpenAI({
  apiKey: process.env.OpenAI,
});

export async function getEmbedding(text) {
  const response = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });
  return response.data[0].embedding;
}
