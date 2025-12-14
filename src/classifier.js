// src/classifier.js (UPDATED with local embedding support)
import OpenAI from "openai";

const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL || "http://localhost:3001";
const USE_LOCAL_EMBEDDINGS = process.env.USE_LOCAL_EMBEDDINGS !== "false"; // Default: true

// Global state
let embeddings = {};
let categoryThresholds = {};
let embeddingClient;

/**
 * Get embedding using LOCAL service (FREE)
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
    console.error(`[Local Embedding] Failed:`, err.message);
    throw err;
  }
}

/**
 * Get embedding using OpenAI API (COSTS MONEY)
 */
async function getOpenAIEmbedding(text, apiKey) {
  if (!embeddingClient && !apiKey) {
    throw new Error("No OpenAI API key available");
  }

  const client = apiKey ? new OpenAI({ apiKey }) : embeddingClient;
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
    console.error(`[OpenAI Embedding] Failed:`, err.message);
    throw err;
  }
}

/**
 * Smart embedding function - tries local first, falls back to OpenAI
 */
async function getEmbedding(text, apiKey) {
  if (USE_LOCAL_EMBEDDINGS) {
    try {
      console.log("[Classifier] Using local embedding (FREE)");
      return await getLocalEmbedding(text);
    } catch (err) {
      console.warn(
        "[Classifier] Local embedding failed, trying OpenAI:",
        err.message
      );
      if (!embeddingClient && !apiKey) {
        throw new Error("Local embedding failed and no OpenAI key available");
      }
      return await getOpenAIEmbedding(text, apiKey);
    }
  } else {
    console.log("[Classifier] Using OpenAI embedding (costs money)");
    return await getOpenAIEmbedding(text, apiKey);
  }
}

/**
 * Initialize classifier - load embeddings once at startup
 */
export async function initClassifier({ openaiApiKey } = {}) {
  console.log("[Classifier] Initializing...");
  console.log(
    `[Classifier] Embedding mode: ${
      USE_LOCAL_EMBEDDINGS ? "LOCAL (FREE)" : "OpenAI (PAID)"
    }`
  );

  if (openaiApiKey) {
    embeddingClient = new OpenAI({ apiKey: openaiApiKey });
  }

  // Load embeddings directly from database
  try {
    console.log("[Classifier] Loading embeddings from database...");
    const { initDatabase } = await import("./db/database.js");
    const { getAllEmbeddings } = await import("./db/queries/embeddings.js");
    const { getAllCategories } = await import("./db/queries/categories.js");

    await initDatabase();
    const dbEmbeddings = await getAllEmbeddings();
    const categories = await getAllCategories();

    if (dbEmbeddings && Object.keys(dbEmbeddings).length > 0) {
      embeddings = dbEmbeddings;
      categoryThresholds = {};

      for (const category of categories) {
        categoryThresholds[category.name] = category.threshold || 0.4;
      }

      const totalExamples = Object.values(embeddings).reduce(
        (sum, exs) => sum + (Array.isArray(exs) ? exs.length : 0),
        0
      );
      console.log(
        `[Classifier] ✅ Loaded ${
          Object.keys(embeddings).length
        } categories, ${totalExamples} embeddings from database into memory`
      );
      return;
    }
  } catch (err) {
    console.warn("[Classifier] Database load failed:", err.message);
  }

  console.warn("[Classifier] ⚠️ No embeddings loaded. Will use GPT fallback.");
  embeddings = {};
  categoryThresholds = {};
}

/**
 * Clear classifier cache
 */
export function clearClassifierCache() {
  console.log("[Classifier] Clearing in-memory cache");
  embeddings = {};
  categoryThresholds = {};
}

/**
 * Reload embeddings from database into memory
 */
export async function reloadEmbeddings() {
  console.log("[Classifier] Reloading embeddings from database...");

  clearClassifierCache();

  // Load fresh from database
  try {
    const { initDatabase } = await import("./db/database.js");
    const { getAllEmbeddings } = await import("./db/queries/embeddings.js");
    const { getAllCategories } = await import("./db/queries/categories.js");

    await initDatabase();
    const dbEmbeddings = await getAllEmbeddings();
    const categories = await getAllCategories();

    if (dbEmbeddings && Object.keys(dbEmbeddings).length > 0) {
      embeddings = dbEmbeddings;
      categoryThresholds = {};

      for (const category of categories) {
        categoryThresholds[category.name] = category.threshold || 0.4;
      }

      const totalExamples = Object.values(embeddings).reduce(
        (sum, exs) => sum + (Array.isArray(exs) ? exs.length : 0),
        0
      );
      console.log(
        `[Classifier] ✅ Reloaded ${
          Object.keys(embeddings).length
        } categories, ${totalExamples} embeddings from database into memory`
      );
      return;
    }
  } catch (err) {
    console.error("[Classifier] Failed to reload from database:", err.message);
    console.warn("[Classifier] ⚠️ No embeddings loaded. Falling back to GPT.");
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;

  const minLen = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < minLen; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

/**
 * Find best matching category using cosine similarity
 */
function classifyEmbedding(inputEmbedding) {
  let bestMatch = { label: null, score: -1 };

  for (const [categoryName, examples] of Object.entries(embeddings)) {
    if (!Array.isArray(examples)) continue;

    for (const example of examples) {
      const exampleVector = Array.isArray(example) ? example : example.vector;
      if (!Array.isArray(exampleVector)) continue;

      const similarity = cosineSimilarity(inputEmbedding, exampleVector);
      if (similarity > bestMatch.score) {
        bestMatch.label = categoryName;
        bestMatch.score = similarity;
      }
    }
  }

  return bestMatch;
}

/**
 * Get threshold for a category
 */
function getCategoryThreshold(categoryName) {
  return categoryThresholds[categoryName] || 0.4;
}

/**
 * Classify text using GPT fallback
 */
async function gptFallbackClassify(text) {
  try {
    const { initDatabase } = await import("./db/database.js");
    const { getAllCategories } = await import("./db/queries/categories.js");

    await initDatabase();
    const categories = await getAllCategories();

    if (!categories || categories.length === 0) {
      console.error("[GPT Fallback] No categories found");
      return null;
    }

    const categoryList = categories.map((cat) => `- ${cat.name}`).join("\n");
    const prompt = `You are a classifier. Classify this request into one of these categories:
${categoryList}

Respond with JSON: { "label": "<category>", "confidence": 0.0-1.0 }

Request: "${text}"`;

    const model = process.env.FALLBACK_MODEL || "gpt-4o-mini";
    console.log(`[GPT Fallback] Calling ${model}...`);
    const startTime = Date.now();

    const response = await embeddingClient.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const content = response.choices?.[0]?.message?.content?.trim();

    console.log(`[GPT Fallback] Response in ${duration}s`);

    if (!content) return null;

    try {
      const parsed = JSON.parse(content);
      if (parsed.label && categories.some((c) => c.name === parsed.label)) {
        return {
          label: parsed.label,
          confidence: parsed.confidence ?? 0.5,
          tokens: response.usage || {},
        };
      }
    } catch (e) {
      const firstLine = content.split("\n")[0].trim();
      if (categories.some((c) => c.name === firstLine)) {
        return {
          label: firstLine,
          confidence: 0.5,
          tokens: response.usage || {},
        };
      }
    }

    return null;
  } catch (err) {
    console.error("[GPT Fallback] Error:", err.message);
    return null;
  }
}

/**
 * Main classification function
 */
export async function classifyText(
  text,
  apiKey,
  { useGptFallback = true } = {}
) {
  try {
    if (Object.keys(embeddings).length === 0) {
      console.warn("[Classify] No embeddings loaded. Using GPT fallback.");
      const fallback = await gptFallbackClassify(text);
      if (fallback) {
        return {
          prompt: text,
          label: fallback.label,
          score: fallback.confidence,
          source: "fallback",
          consumption: null,
        };
      }
      return {
        prompt: text,
        label: "unknown",
        score: 0,
        source: "fallback",
        consumption: null,
      };
    }

    // Get embedding for input (try local first)
    const embeddingResult = await getEmbedding(text, apiKey);
    const inputEmbedding = embeddingResult.embedding;
    const embeddingTokens = embeddingResult.usage?.total_tokens || 0;

    // Find best match
    const best = classifyEmbedding(inputEmbedding);
    const threshold = best.label ? getCategoryThreshold(best.label) : 0.4;

    console.log(
      `[Classify] Best: ${best.label || "none"} (score: ${best.score.toFixed(
        4
      )}, threshold: ${threshold})`
    );

    // If score above threshold, return local result
    if (best.label && best.score >= threshold) {
      console.log(
        `[Classify] ✅ Local classification (${best.score.toFixed(
          4
        )} >= ${threshold})`
      );
      const embeddingCost = USE_LOCAL_EMBEDDINGS
        ? 0
        : (embeddingTokens / 1000) * 0.00013;
      return {
        prompt: text,
        label: best.label,
        score: best.score,
        source: "Local",
        usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
        consumption: {
          tokens: { embedding: embeddingTokens, total: embeddingTokens },
          cost: { embeddings: embeddingCost, total: embeddingCost },
        },
      };
    }

    // Score too low, use GPT fallback
    console.log(
      `[Classify] Score ${best.score.toFixed(
        4
      )} < threshold ${threshold}, using GPT fallback`
    );

    if (!useGptFallback || !embeddingClient) {
      return {
        prompt: text,
        label: best.label || "unknown",
        score: best.score,
        source: "Local",
        usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
        consumption: null,
      };
    }

    const fallback = await gptFallbackClassify(text);
    if (fallback) {
      const embeddingCost = USE_LOCAL_EMBEDDINGS
        ? 0
        : (embeddingTokens / 1000) * 0.00013;
      const gptInputCost =
        ((fallback.tokens?.prompt_tokens || 0) / 1000000) * 0.15;
      const gptOutputCost =
        ((fallback.tokens?.completion_tokens || 0) / 1000000) * 0.6;

      return {
        prompt: text,
        label: fallback.label,
        score: fallback.confidence,
        source: "fallback",
        usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
        consumption: {
          tokens: {
            embedding: embeddingTokens,
            gpt_input: fallback.tokens?.prompt_tokens || 0,
            gpt_output: fallback.tokens?.completion_tokens || 0,
            total: embeddingTokens + (fallback.tokens?.total_tokens || 0),
          },
          cost: {
            embeddings: embeddingCost,
            gpt: gptInputCost + gptOutputCost,
            total: embeddingCost + gptInputCost + gptOutputCost,
          },
        },
      };
    }

    const embeddingCost = USE_LOCAL_EMBEDDINGS
      ? 0
      : (embeddingTokens / 1000) * 0.00013;
    return {
      prompt: text,
      label: best.label || "unknown",
      score: best.score || 0,
      source: "fallback",
      usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
      consumption: {
        tokens: { embedding: embeddingTokens, total: embeddingTokens },
        cost: { embeddings: embeddingCost, total: embeddingCost },
      },
    };
  } catch (err) {
    console.error("[Classify] Error:", err.message);
    throw err;
  }
}
