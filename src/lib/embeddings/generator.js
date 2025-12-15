/**
 * Embedding Generator
 * Handles generating embeddings via Local Service (Free) or OpenAI (Paid).
 */

import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OpenAI;
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:3000";
const USE_LOCAL_EMBEDDINGS = process.env.USE_LOCAL_EMBEDDINGS !== "false"; // Default: true

/**
 * Get embedding using LOCAL service (FREE)
 * @param {string} text
 * @returns {Promise<Object>} { embedding: [], usage: { total_tokens: 0 } }
 */
async function getLocalEmbedding(text) {
  try {
    const response = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Local embedding error: ${error.error}`);
    }

    const result = await response.json();
    return {
      embedding: result.embedding,
      usage: { total_tokens: 0 }, // Local = free
    };
  } catch (err) {
    // console.error(`[Local Embedding] Failed:`, err.message);
    throw err;
  }
}

/**
 * Get embedding using OpenAI API (COSTS MONEY)
 * @param {string} text
 * @returns {Promise<Object>}
 */
async function getOpenAIEmbedding(text) {
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
    // console.error(`[OpenAI Embedding] Failed:`, err.message);
    throw err;
  }
}

/**
 * Smart embedding function - tries local first, falls back to OpenAI
 * @param {string} text
 * @returns {Promise<Object>}
 */
export async function getEmbedding(text) {
  if (USE_LOCAL_EMBEDDINGS) {
    try {
      return await getLocalEmbedding(text);
    } catch (err) {
      console.warn(`[Generator] Local failed, trying OpenAI: ${err.message}`);
      if (!OPENAI_API_KEY) {
        throw new Error("Local embedding failed and no OpenAI key available");
      }
      return await getOpenAIEmbedding(text);
    }
  } else {
    return await getOpenAIEmbedding(text);
  }
}
