// src/classifier.js
import { ClassifierCache } from "./lib/classifier/cache.js";
import { findBestMatch } from "./lib/classifier/engine.js";
import { getEmbedding } from "./lib/embeddings/generator.js";
import { gptFallbackClassify } from "./lib/classifier/fallback.js";
import { getAllCategories } from "./db/queries/categories.js";

/**
 * Initialize classifier - load embeddings from database
 */
export async function initClassifier() {
  await ClassifierCache.init();
}

/**
 * Main classification function
 */
export async function classifyText(text, { useGptFallback = true } = {}) {
  try {
    // Ensure cache is ready (double check)
    if (!ClassifierCache.isReady()) {
       console.warn("[Classify] Cache not ready, attempting initialization...");
       await ClassifierCache.init();
    }

    // Ensure cache is fresh relative to DB (lightweight, TTL-limited check)
    await ClassifierCache.checkFreshness();

    const embeddings = ClassifierCache.getEmbeddings();

    // Get embedding using OpenAI
    const embeddingResult = await getEmbedding(text);
    const inputEmbedding = embeddingResult.embedding;
    const embeddingTokens = embeddingResult.usage?.total_tokens || 0;
    const embeddingCost = (embeddingTokens / 1000) * 0.00013;

    // Find best match using optimized engine
    const best = findBestMatch(inputEmbedding, embeddings);
    const threshold = ClassifierCache.getThreshold();

    console.log(
      `[Classify] Best: ${best.label || "none"} (score: ${best.score.toFixed(4)}, threshold: ${threshold})`
    );

    // Check threshold
    if (best.label && best.score >= threshold) {
        return {
            prompt: text,
            label: best.label,
            score: best.score,
            source: "Local",
            consumption: {
                tokens: { 
                    embedding: embeddingTokens,
                    total: embeddingTokens 
                },
                cost: { 
                    embeddings: embeddingCost,
                    total: embeddingCost 
                },
            },
        };
    }

    // Fallback to GPT
    console.log(`[Classify] Score ${best.score.toFixed(4)} < threshold, using GPT fallback`);

    if (!useGptFallback) {
        return {
            prompt: text,
            label: best.label || "unknown",
            score: best.score,
            source: "Local",
            consumption: null,
        };
    }

    // Get categories for fallback prompt
    const categories = await getAllCategories();
    const fallback = await gptFallbackClassify(text, categories);

    if (fallback) {
        const gptInputCost = ((fallback.tokens?.prompt_tokens || 0) / 1000000) * 0.15;
        const gptOutputCost = ((fallback.tokens?.completion_tokens || 0) / 1000000) * 0.6;
        const totalCost = embeddingCost + gptInputCost + gptOutputCost;
        const totalTokens = embeddingTokens + (fallback.tokens?.total_tokens || 0);

        return {
            prompt: text,
            label: fallback.label,
            score: fallback.confidence,
            source: "fallback",
            consumption: {
              tokens: {
                embedding: embeddingTokens,
                gpt_input: fallback.tokens?.prompt_tokens || 0,
                gpt_output: fallback.tokens?.completion_tokens || 0,
                total: totalTokens,
              },
              cost: {
                embeddings: embeddingCost,
                gpt: gptInputCost + gptOutputCost,
                total: totalCost,
              },
            },
        };
    }

    // Fallback failed
    return {
        prompt: text,
        label: best.label || "unknown",
        score: best.score || 0,
        source: "fallback",
        consumption: null,
    };

  } catch (err) {
    console.error("[Classify] Error:", err.message);
    throw err;
  }
}
