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
let client;
let embeddingClient;

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
export function initClassifier({ openaiApiKey } = {}) {
  const embeddingsPath = findEmbeddingsFile();

  if (embeddingsPath) {
    try {
      embeddings = JSON.parse(fs.readFileSync(embeddingsPath, "utf-8"));
      console.log(`Embeddings loaded from: ${embeddingsPath}`);
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

  if (openaiApiKey) {
    client = new OpenAI({ apiKey: openaiApiKey, timeout: 120000 });
    embeddingClient = new OpenAI({ apiKey: openaiApiKey });
    console.log("OpenAI client initialized for embeddings and GPT fallback");
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

  const response = await clientToUse.embeddings.create({
    model: "text-embedding-3-large",
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

// GPT fallback classification for ambiguous or low-confidence cases
async function gptFallbackClassifier(text) {
  if (!client) return null;

  try {
    const prompt = `
You are a classifier assistant. Classify the following user request into one of these categories:
- low_effort
- reasoning
- code
- image_generation
- image_edit
- web_surfing
- ppt_generation

Respond with JSON like: { "label": "<category>", "confidence": 0.0-1.0 }

Request: """${text}"""
`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
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

    try {
      const parsed = JSON.parse(content);
      if (
        parsed.label &&
        [
          "low_effort",
          "reasoning",
          "code",
          "image_generation",
          "image_edit",
          "web_surfing",
          "ppt_generation",
        ].includes(parsed.label)
      ) {
        return { ...parsed, tokens }; // { label, confidence, tokens }
      }
    } catch (err) {
      // fallback: if GPT didn't return JSON, just return label with default confidence
      const label = content.split("\n")[0].trim();
      if (
        [
          "low_effort",
          "reasoning",
          "code",
          "image_generation",
          "image_edit",
          "web_surfing",
          "ppt_generation",
        ].includes(label)
      ) {
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
export function reloadEmbeddings() {
  const embeddingsPath = findEmbeddingsFile();

  if (embeddingsPath) {
    try {
      embeddings = JSON.parse(fs.readFileSync(embeddingsPath, "utf-8"));
      console.log(`Embeddings reloaded from: ${embeddingsPath}`);
    } catch (err) {
      console.warn("Failed to reload embeddings:", err.message);
      embeddings = {};
    }
  } else {
    console.warn("Embeddings file not found during reload");
    embeddings = {};
  }
}

// Classify text: check local embeddings first, only call GPT fallback if score < 0.4
export async function classifyText(
  text,
  apiKey,
  { useGptFallback = true } = {}
) {
  try {
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

    // If score >= 0.4, return local result with no consumption shown
    if (best.label && best.score >= 0.4) {
      return {
        prompt: text,
        label: best.label,
        score: best.score,
        source: "Local",
        consumption: null, // No consumption shown for local classification
      };
    }

    // Score < 0.4, use GPT fallback with consumption tracking
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

  // If we got a good match after loading, return it (but this shouldn't happen often)
  if (best.label && best.score >= 0.4) {
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
