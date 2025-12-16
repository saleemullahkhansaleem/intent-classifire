/**
 * Embedding Recomputer
 * Orchestrates the recomputation of embeddings for uncomputed examples.
 * Features:
 * - Batched concurrency
 * - Strict cache synchronization
 * - Cost tracking
 */

import { ClassifierCache } from "../classifier/cache.js";
import { getEmbedding } from "./generator.js";

// Concurrency limit for embedding generation
const CONCURRENCY_LIMIT = 5;

/**
 * Recompute embeddings for all uncomputed examples.
 * @param {Object} options
 * @returns {Promise<Object>} Stats
 */
export async function recomputeEmbeddings(options = {}) {
  const { maxDuration = 60, maxExamples = null } = options;
  const startTime = Date.now();

  console.log("[Recomputer] Starting recomputation task...");

  // Dynamic imports for DB layer
  const { initDatabase } = await import("../../db/database.js");
  const { getAllCategories } = await import("../../db/queries/categories.js");
  const { getUncomputedExamplesByCategoryId } = await import("../../db/queries/examples.js");
  const { updateExampleEmbedding } = await import("../../db/queries/embeddings.js");

  await initDatabase();
  const categories = await getAllCategories();

  const stats = {
    totalProcessed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    totalTokens: 0,
    elapsedSeconds: 0,
  };

  for (const category of categories) {
    if (isTimeUp(startTime, maxDuration)) break;
    if (maxExamples && stats.totalProcessed >= maxExamples) break;

    const uncomputed = await getUncomputedExamplesByCategoryId(category.id);
    if (!uncomputed || uncomputed.length === 0) continue;

    console.log(`[Recomputer] Category '${category.name}': found ${uncomputed.length} uncomputed examples.`);

    // Process in batches for concurrency
    for (let i = 0; i < uncomputed.length; i += CONCURRENCY_LIMIT) {
      if (isTimeUp(startTime, maxDuration)) break;
      if (maxExamples && stats.totalProcessed >= maxExamples) break;

      const batch = uncomputed.slice(i, i + CONCURRENCY_LIMIT);

      await Promise.all(batch.map(async (example) => {
        try {
            const result = await getEmbedding(example.text);
            await updateExampleEmbedding(example.id, result.embedding);

            stats.success++;
            stats.totalTokens += (result.usage?.total_tokens || 0);
        } catch (err) {
            console.error(`[Recomputer] Failed example ${example.id}: ${err.message}`);
            stats.failed++;
        } finally {
            stats.totalProcessed++;
        }
      }));
    }
  }

  // CRITICAL: Strict Consistency
  // Always reload cache after any recomputation attempt
  console.log("[Recomputer] Syncing cache with database...");
  await ClassifierCache.reload();

  stats.elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Recomputer] Finished. Stats:`, stats);

  return stats;
}

function isTimeUp(startTime, maxDuration) {
  return (Date.now() - startTime) / 1000 > maxDuration;
}
