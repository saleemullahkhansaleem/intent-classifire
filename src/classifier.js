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

// Initialize classifier and optionally OpenAI client for GPT fallback
export function initClassifier({ openaiApiKey } = {}) {
  const p = path.resolve(projectRoot, "src", "classifier_embeddings.json");
  embeddings = JSON.parse(fs.readFileSync(p, "utf-8"));
  console.log("Embeddings loaded");

  if (openaiApiKey) {
    client = new OpenAI({ apiKey: openaiApiKey, timeout: 120000 });
    console.log("OpenAI client initialized for fallback GPT classification");
  }
}

// Cosine similarity (safe)
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
  const minL = Math.min(vecA.length, vecB.length);
  let dot = 0, na = 0, nb = 0;
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
        ["low_effort","reasoning","code","image_generation","image_edit","web_surfing","ppt_generation"].includes(parsed.label)
      ) {
        return { ...parsed, tokens }; // { label, confidence, tokens }
      }
    } catch (err) {
      // fallback: if GPT didn't return JSON, just return label with default confidence
      const label = content.split("\n")[0].trim();
      if (
        ["low_effort","reasoning","code","image_generation","image_edit","web_surfing","ppt_generation"].includes(label)
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
  const p = path.resolve(projectRoot, "src", "classifier_embeddings.json");
  embeddings = JSON.parse(fs.readFileSync(p, "utf-8"));
  console.log("Embeddings reloaded");
}

// Classify text: primary embedding + optional GPT fallback
// getEmbedding can return just embedding array or { embedding, usage }
export async function classifyText(getEmbedding, text, { useGptFallback = true } = {}) {
  let source = "local"; // default
  let result;
  let consumption = {
    tokens: { input: 0, output: 0, total: 0 },
    cost: { embeddings: 0, gpt: 0, total: 0 },
  };

  // 1) embed the input
  let embeddingTokens = 0;
  let inputEmbedding;

  try {
    const embeddingResponse = await getEmbedding(text);

    // Handle both formats: array or object with usage
    if (Array.isArray(embeddingResponse)) {
      inputEmbedding = embeddingResponse;
      // Estimate tokens (rough: ~1 token per 4 chars for embeddings)
      embeddingTokens = Math.ceil(text.length / 4);
    } else if (embeddingResponse.embedding) {
      inputEmbedding = embeddingResponse.embedding;
      embeddingTokens = embeddingResponse.usage?.total_tokens || Math.ceil(text.length / 4);
    } else {
      inputEmbedding = embeddingResponse;
      embeddingTokens = Math.ceil(text.length / 4);
    }

    // 2) primary embedding-based guess
    const best = classifyEmbedding(inputEmbedding);

    if (best.label && best.score >= 0.4) {
      // Calculate embedding cost: ~$0.00013 per 1K tokens
      const embeddingCost = (embeddingTokens / 1000) * 0.00013;
      consumption.tokens.input = embeddingTokens;
      consumption.tokens.total = embeddingTokens;
      consumption.cost.embeddings = embeddingCost;
      consumption.cost.total = embeddingCost;

      result = {
        prompt: text,
        label: best.label,
        score: best.score,
        source,
        consumption
      };
      return result;
    }

    // 3) fallback to GPT if low confidence
    if (useGptFallback && client) {
      const gptResult = await gptFallbackClassifier(text);
      if (gptResult) {
        // Calculate costs
        const embeddingCost = (embeddingTokens / 1000) * 0.00013;
        const gptInputCost = ((gptResult.tokens?.input || 0) / 1000000) * 0.15;
        const gptOutputCost = ((gptResult.tokens?.output || 0) / 1000000) * 0.60;
        const gptCost = gptInputCost + gptOutputCost;

        consumption.tokens.input = embeddingTokens + (gptResult.tokens?.input || 0);
        consumption.tokens.output = gptResult.tokens?.output || 0;
        consumption.tokens.total = embeddingTokens + (gptResult.tokens?.total || 0);
        consumption.cost.embeddings = embeddingCost;
        consumption.cost.gpt = gptCost;
        consumption.cost.total = embeddingCost + gptCost;

        result = {
          prompt: text,
          label: gptResult.label,
          score: gptResult.confidence ?? 0.5,
          source: "fallback",
          consumption
        };
        return result;
      }
    }

    // 4) fallback to low_effort if no label
    const embeddingCost = (embeddingTokens / 1000) * 0.00013;
    consumption.tokens.input = embeddingTokens;
    consumption.tokens.total = embeddingTokens;
    consumption.cost.embeddings = embeddingCost;
    consumption.cost.total = embeddingCost;

    result = {
      prompt: text,
      label: "low_effort",
      score: 0,
      source,
      consumption
    };
    return result;
  } catch (err) {
    console.error("Error in classifyText:", err);
    throw err;
  }
}
