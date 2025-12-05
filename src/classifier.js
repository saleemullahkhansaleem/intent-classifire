// src/classifier.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root directory (go up from src/)
const projectRoot = path.resolve(__dirname, "..");

let embeddings = {};
let categoryThresholds = {}; // Store per-category thresholds
let client;
let embeddingClient;
let useDatabase = false;

// Helper function to find embeddings file using multiple path strategies
function findEmbeddingsFile() {
  const possiblePaths = [
    // Standard path from project root
    path.resolve(projectRoot, "src", "classifier_embeddings.json"),
    // Path relative to current working directory (for Vercel)
    path.resolve(process.cwd(), "src", "classifier_embeddings.json"),
    // Path from __dirname (current file location)
    path.resolve(__dirname, "classifier_embeddings.json"),
    // Absolute path fallback
    "/vercel/path0/src/classifier_embeddings.json",
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

// Initialize classifier and optionally OpenAI client for GPT fallback
export async function initClassifier({ openaiApiKey } = {}) {
  // Try to load from database first
  try {
    const { initDatabase } = await import("./db/database.js");
    const { getAllEmbeddings } = await import("./db/queries/embeddings.js");
    const { getAllCategories } = await import("./db/queries/categories.js");

    await initDatabase();
    const dbEmbeddings = await getAllEmbeddings();
    const categories = await getAllCategories();

    if (Object.keys(dbEmbeddings).length > 0) {
      embeddings = dbEmbeddings;
      // Store thresholds by category name
      categoryThresholds = {};
      for (const category of categories) {
        categoryThresholds[category.name] = category.threshold || 0.4;
      }
      useDatabase = true;
      console.log(
        `✅ Embeddings loaded from database (${
          Object.keys(embeddings).length
        } categories)`
      );
      console.log(`Category thresholds loaded:`, categoryThresholds);

      // Log embedding counts per category for debugging
      for (const [catName, exs] of Object.entries(embeddings)) {
        console.log(`  - ${catName}: ${exs.length} examples with embeddings`);
      }
    } else {
      console.warn(
        "No embeddings found in database, falling back to JSON file"
      );
      // Fallback to JSON file
      await loadEmbeddingsFromFile();
    }
  } catch (err) {
    console.warn(
      "Database not available, falling back to JSON file:",
      err.message
    );
    await loadEmbeddingsFromFile();
  }

  if (openaiApiKey) {
    client = new OpenAI({ apiKey: openaiApiKey, timeout: 120000 });
    embeddingClient = new OpenAI({ apiKey: openaiApiKey });
    console.log("OpenAI client initialized for embeddings and GPT fallback");
  }
}

// Load embeddings from JSON file (fallback)
async function loadEmbeddingsFromFile() {
  const embeddingsPath = findEmbeddingsFile();

  if (embeddingsPath) {
    try {
      embeddings = JSON.parse(fs.readFileSync(embeddingsPath, "utf-8"));
      console.log(`Embeddings loaded from: ${embeddingsPath}`);
      // Use default threshold for all categories from JSON
      for (const categoryName of Object.keys(embeddings)) {
        categoryThresholds[categoryName] = 0.4;
      }
    } catch (err) {
      console.warn(
        "Failed to load embeddings file, using empty embeddings:",
        err.message
      );
      embeddings = {};
    }
  } else {
    console.warn(
      "Embeddings file not found. Using empty embeddings. Please run recompute-embeddings endpoint to generate it."
    );
    embeddings = {};
  }
}

// Get embedding using OpenAI API (merged from embed.js)
async function getEmbedding(text, apiKey) {
  let clientToUse;

  if (apiKey) {
    clientToUse = new OpenAI({ apiKey });
  } else if (embeddingClient) {
    clientToUse = embeddingClient;
  } else {
    throw new Error("OpenAI API key not set");
  }

  const embeddingModel =
    process.env.EMBEDDING_MODEL || "text-embedding-3-large";
  const response = await clientToUse.embeddings.create({
    model: embeddingModel,
    input: text,
  });

  return {
    embedding: response.data[0].embedding,
    usage: response.usage || { total_tokens: 0 },
  };
}

// Cosine similarity (safe)
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
  const minL = Math.min(vecA.length, vecB.length);
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < minL; i++) {
    dot += vecA[i] * vecB[i];
    na += vecA[i] * vecA[i];
    nb += vecB[i] * vecB[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Core embedding classification
export function classifyEmbedding(inputEmbedding) {
  let best = { label: null, score: -1 };
  for (const [label, examples] of Object.entries(embeddings)) {
    if (!Array.isArray(examples)) continue;
    for (const ex of examples) {
      const vec = Array.isArray(ex) ? ex : ex.vector;
      if (!Array.isArray(vec)) continue;
      const sim = cosineSimilarity(inputEmbedding, vec);
      if (sim > best.score) {
        best.label = label;
        best.score = sim;
      }
    }
  }
  return best;
}

// Get threshold for a category (defaults to 0.4)
export function getCategoryThreshold(categoryName) {
  return categoryThresholds[categoryName] || 0.4;
}

// GPT fallback classification for ambiguous or low-confidence cases
async function gptFallbackClassifier(text) {
  if (!client) return null;

  try {
    // Dynamically load categories from database or use defaults
    let categoryList = [];
    try {
      const { getCategoriesForPrompt } = await import("./config/categories.js");
      const categories = await getCategoriesForPrompt();
      categoryList = categories.map((cat) => `- ${cat.name}`);
    } catch (err) {
      // Fallback to default categories
      categoryList = [
        "- low_effort",
        "- reasoning",
        "- code",
        "- image_generation",
        "- image_edit",
        "- web_surfing",
        "- ppt_generation",
      ];
    }

    const prompt = `
You are a classifier assistant. Classify the following user request into one of these categories:
${categoryList.join("\n")}

Respond with JSON like: { "label": "<category>", "confidence": 0.0-1.0 }

Request: """${text}"""
`;

    const fallbackModel = process.env.FALLBACK_MODEL || "gpt-4o-mini";
    const res = await client.chat.completions.create({
      model: fallbackModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    const content = res.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    // Extract token usage
    const usage = res.usage || {};
    const tokens = {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
      total: usage.total_tokens || 0,
    };

    // Validate against database categories
    let validCategories = [];
    try {
      const { getValidCategoryNames } = await import("./config/categories.js");
      validCategories = await getValidCategoryNames();
    } catch (err) {
      // Fallback to default categories
      validCategories = [
        "low_effort",
        "reasoning",
        "code",
        "image_generation",
        "image_edit",
        "web_surfing",
        "ppt_generation",
      ];
    }

    try {
      const parsed = JSON.parse(content);
      if (parsed.label && validCategories.includes(parsed.label)) {
        return { ...parsed, tokens }; // { label, confidence, tokens }
      }
    } catch (err) {
      // fallback: if GPT didn't return JSON, just return label with default confidence
      const label = content.split("\n")[0].trim();
      if (validCategories.includes(label)) {
        return { label, confidence: 0.5, tokens };
      }
    }

    return null;
  } catch (err) {
    console.warn("GPT fallback failed:", err.message);
    return null;
  }
}

// Reload embeddings (useful after recomputation)
export async function reloadEmbeddings() {
  // Always try database first if POSTGRES_URL is available
  const shouldUseDatabase = useDatabase || process.env.POSTGRES_URL;

  if (shouldUseDatabase) {
    try {
      const { initDatabase } = await import("./db/database.js");
      const { getAllEmbeddings } = await import("./db/queries/embeddings.js");
      const { getAllCategories } = await import("./db/queries/categories.js");

      await initDatabase();
      const dbEmbeddings = await getAllEmbeddings();
      const categories = await getAllCategories();

      if (Object.keys(dbEmbeddings).length > 0) {
        embeddings = dbEmbeddings;
        categoryThresholds = {};
        for (const category of categories) {
          categoryThresholds[category.name] = category.threshold || 0.4;
        }
        useDatabase = true;
        console.log(
          `Embeddings reloaded from database (${
            Object.keys(embeddings).length
          } categories)`
        );
        return;
      }
    } catch (err) {
      console.warn("Failed to reload embeddings from database:", err.message);
    }
  }

  // Fallback to JSON file
  await loadEmbeddingsFromFile();
}

// Classify text: check local embeddings first, only call GPT fallback if score < 0.4
export async function classifyText(
  text,
  apiKey,
  { useGptFallback = true } = {}
) {
  try {
    // Ensure embeddings are loaded (reload from database if needed)
    if (Object.keys(embeddings).length === 0 || useDatabase) {
      try {
        await reloadEmbeddings();
      } catch (err) {
        console.warn("Failed to reload embeddings:", err.message);
      }
    }

    // Check if we have local embeddings loaded
    if (Object.keys(embeddings).length === 0) {
      // No local embeddings, must use API fallback
      return await classifyWithFallback(text, apiKey, useGptFallback);
    }

    // Compute embedding for input text (necessary to compare with local embeddings)
    const embeddingResponse = await getEmbedding(text, apiKey);
    const inputEmbedding = embeddingResponse.embedding;
    const embeddingTokens = embeddingResponse.usage?.total_tokens || 0;

    // Compare with local embeddings
    const best = classifyEmbedding(inputEmbedding);

    // Get threshold for the matched category
    const threshold = best.label ? getCategoryThreshold(best.label) : 0.4;

    // Debug logging
    console.log(`[Classify] Text: "${text.substring(0, 50)}..."`);
    console.log(
      `[Classify] Best match: ${
        best.label || "none"
      } (score: ${best.score.toFixed(4)}, threshold: ${threshold})`
    );
    console.log(
      `[Classify] Embeddings loaded: ${
        Object.keys(embeddings).length
      } categories`
    );

    // If score >= threshold, return local result with no consumption shown
    if (best.label && best.score >= threshold) {
      console.log(
        `[Classify] ✅ Using LOCAL classification (score ${best.score.toFixed(
          4
        )} >= threshold ${threshold})`
      );
      return {
        prompt: text,
        label: best.label,
        score: best.score,
        source: "Local",
        consumption: null, // No consumption shown for local classification
      };
    }

    console.log(
      `[Classify] ⚠️ Score ${best.score.toFixed(
        4
      )} < threshold ${threshold}, using GPT fallback`
    );

    // Score < threshold, use GPT fallback with consumption tracking
    return await classifyWithFallback(text, apiKey, useGptFallback, {
      inputEmbedding,
      embeddingTokens,
    });
  } catch (err) {
    console.error("Error in classifyText:", err);
    throw err;
  }
}

// Helper function to classify with fallback API (when score < 0.4)
async function classifyWithFallback(
  text,
  apiKey,
  useGptFallback,
  { inputEmbedding, embeddingTokens } = {}
) {
  const consumption = {
    tokens: { input: 0, output: 0, total: 0 },
    cost: { embeddings: 0, gpt: 0, total: 0 },
  };

  // Get embedding if not provided
  if (!inputEmbedding) {
    const embeddingResponse = await getEmbedding(text, apiKey);
    inputEmbedding = embeddingResponse.embedding;
    embeddingTokens = embeddingResponse.usage?.total_tokens || 0;
  }

  // Check local embeddings one more time (in case they were just loaded)
  const best = classifyEmbedding(inputEmbedding);

  // Get threshold for the matched category
  const threshold = best.label ? getCategoryThreshold(best.label) : 0.4;

  // If we got a good match after loading, return it (but this shouldn't happen often)
  if (best.label && best.score >= threshold) {
    return {
      prompt: text,
      label: best.label,
      score: best.score,
      source: "Local",
      consumption: null,
    };
  }

  // Call GPT fallback
  if (useGptFallback && client) {
    const gptResult = await gptFallbackClassifier(text);
    if (gptResult) {
      // Calculate costs
      const embeddingCost = (embeddingTokens / 1000) * 0.00013;
      const gptInputCost = ((gptResult.tokens?.input || 0) / 1000000) * 0.15;
      const gptOutputCost = ((gptResult.tokens?.output || 0) / 1000000) * 0.6;
      const gptCost = gptInputCost + gptOutputCost;

      consumption.tokens.input =
        embeddingTokens + (gptResult.tokens?.input || 0);
      consumption.tokens.output = gptResult.tokens?.output || 0;
      consumption.tokens.total =
        embeddingTokens + (gptResult.tokens?.total || 0);
      consumption.cost.embeddings = embeddingCost;
      consumption.cost.gpt = gptCost;
      consumption.cost.total = embeddingCost + gptCost;

      return {
        prompt: text,
        label: gptResult.label,
        score: gptResult.confidence ?? 0.5,
        source: "fallback",
        consumption,
      };
    }
  }

  // Final fallback: no label found, use low_effort
  const embeddingCost = (embeddingTokens / 1000) * 0.00013;
  consumption.tokens.input = embeddingTokens;
  consumption.tokens.total = embeddingTokens;
  consumption.cost.embeddings = embeddingCost;
  consumption.cost.total = embeddingCost;

  return {
    prompt: text,
    label: "low_effort",
    score: 0,
    source: "fallback",
    consumption,
  };
}
