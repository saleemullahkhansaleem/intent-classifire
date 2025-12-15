// src/classifier.js (Refactored Facade)
import { ClassifierCache } from "./lib/classifier/cache.js";
import { findBestMatch } from "./lib/classifier/engine.js";
import { getEmbedding } from "./lib/embeddings/generator.js";
import { gptFallbackClassify } from "./lib/classifier/fallback.js";
import { getAllCategories } from "./db/queries/categories.js";

const USE_LOCAL_EMBEDDINGS = process.env.USE_LOCAL_EMBEDDINGS !== "false";

/**
 * Initialize classifier - load embeddings from database
 */
export async function initClassifier() {
  await ClassifierCache.init();
}

/**
 * Clear classifier cache
 */
export function clearClassifierCache() {
  ClassifierCache.clear();
}

/**
 * Reload embeddings from database into memory
 */
export async function reloadEmbeddings() {
  await ClassifierCache.reload();
}

/**
 * Main classification function
 */
export async function classifyText(text, apiKey, { useGptFallback = true } = {}) {
  try {
    // Ensure cache is ready (double check)
    if (!ClassifierCache.isReady()) {
       console.warn("[Classify] Cache not ready, attempting initialization...");
       await ClassifierCache.init();
    }

    // Ensure cache is fresh relative to DB (lightweight, TTL-limited check)
    await ClassifierCache.checkFreshness();

    const embeddings = ClassifierCache.getEmbeddings();

    // 1. Get Embedding (try local first as per generator logic)
    const embeddingResult = await getEmbedding(text);
    const inputEmbedding = embeddingResult.embedding;
    const embeddingTokens = embeddingResult.usage?.total_tokens || 0;
    
    // Calculate embedding cost (local = free, OpenAI = $0.00013 per 1K tokens)
    const embeddingCost = USE_LOCAL_EMBEDDINGS 
      ? 0 
      : (embeddingTokens / 1000) * 0.00013;

    // 2. Find Best Match using optimized engine
    const best = findBestMatch(inputEmbedding, embeddings);
    const threshold = best.label ? ClassifierCache.getThreshold(best.label) : 0.4;

    console.log(
      `[Classify] Best: ${best.label || "none"} (score: ${best.score.toFixed(4)}, threshold: ${threshold})`
    );

    // 3. Check Threshold
    if (best.label && best.score >= threshold) {
        // SUCCESS: Local Classification
        return {
            prompt: text,
            label: best.label,
            score: best.score,
            source: "Local",
            usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
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

    // 4. Fallback
    console.log(`[Classify] Score ${best.score.toFixed(4)} < threshold, using GPT fallback`);

    if (!useGptFallback) {
        return {
            prompt: text,
            label: best.label || "unknown",
            score: best.score,
            source: "Local",
            usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
            consumption: null,
        };
    }

    // Need categories for fallback prompt
    // Ideally we shouldn't fetch DB here, but use cache or efficient query
    // For now, fetching from DB is safe enough if low traffic, or we could add categories to Cache
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
            usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
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
        usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
        consumption: null,
    };

  } catch (err) {
    console.error("[Classify] Error:", err.message);
    throw err;
  }
}
