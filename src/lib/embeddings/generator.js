/**
 * Embedding Generator
 * Generates embeddings using OpenAI API.
 */

import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OpenAI;

/**
 * Get embedding using OpenAI API
 * @param {string} text
 * @returns {Promise<Object>} { embedding: [], usage: { total_tokens: number } }
 */
export async function getEmbedding(text) {
  if (!OPENAI_API_KEY) {
    throw new Error("No OpenAI API key available");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-large";

  try {
    const response = await client.embeddings.create({
      model,
      input: text,
    });

    return {
      embedding: response.data[0].embedding,
      usage: response.usage || { total_tokens: 0 },
    };
  } catch (err) {
    throw new Error(`OpenAI embedding failed: ${err.message}`);
  }
}
