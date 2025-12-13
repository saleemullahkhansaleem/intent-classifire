// src/embeddingService.js (UPDATED with local embedding support)
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { reloadEmbeddings } from "./classifier.js";
import {
  saveEmbeddings,
  invalidateCache,
  reloadFromStorage,
} from "./blobService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.Openai;
const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL || "http://localhost:3001";
const USE_LOCAL_EMBEDDINGS = process.env.USE_LOCAL_EMBEDDINGS !== "false"; // Default: true

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
      throw new Error(
        `Local embedding service error: ${error.error || "Unknown error"}`
      );
    }

    const result = await response.json();
    return {
      embedding: result.embedding,
      usage: { total_tokens: 0 }, // Local = free
    };
  } catch (err) {
    console.error(
      `[Local Embedding] Failed for text "${text.substring(0, 50)}...":`,
      err.message
    );
    throw err;
  }
}

/**
 * Get embedding using OpenAI API (COSTS MONEY)
 */
async function getOpenAIEmbedding(text) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    const embeddingModel =
      process.env.EMBEDDING_MODEL || "text-embedding-3-large";
    const response = await client.embeddings.create({
      model: embeddingModel,
      input: text,
    });

    return {
      embedding: response.data[0].embedding,
      usage: response.usage || { total_tokens: 0 },
    };
  } catch (err) {
    console.error(
      `[OpenAI Embedding] Failed for text "${text.substring(0, 50)}...":`,
      err.message
    );
    throw err;
  }
}

/**
 * Smart embedding function - tries local first, falls back to OpenAI
 */
async function getEmbedding(text) {
  if (USE_LOCAL_EMBEDDINGS) {
    try {
      console.log("[Embedding] Using local service (FREE)");
      return await getLocalEmbedding(text);
    } catch (err) {
      console.warn(
        "[Embedding] Local service failed, falling back to OpenAI:",
        err.message
      );
      if (!OPENAI_API_KEY) {
        throw new Error(
          "Local embedding failed and no OpenAI API key available"
        );
      }
      return await getOpenAIEmbedding(text);
    }
  } else {
    console.log("[Embedding] Using OpenAI (costs money)");
    return await getOpenAIEmbedding(text);
  }
}

/**
 * Recompute embeddings - tries database first, falls back to JSON
 */
export async function recomputeEmbeddings() {
  const isProduction =
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;

  console.log(
    `[Recompute] Environment: ${isProduction ? "Production" : "Local"}`
  );
  console.log(
    `[Recompute] Embedding mode: ${
      USE_LOCAL_EMBEDDINGS ? "LOCAL (FREE)" : "OpenAI (PAID)"
    }`
  );

  // Try database first
  try {
    const { initDatabase } = await import("./db/database.js");
    const { getAllCategories } = await import("./db/queries/categories.js");
    const { getExamplesByCategoryId } = await import(
      "./db/queries/examples.js"
    );
    const { updateExampleEmbedding } = await import(
      "./db/queries/embeddings.js"
    );

    console.log("[Recompute] Initializing database...");
    await initDatabase();

    console.log("[Recompute] Fetching categories from database...");
    const categories = await getAllCategories();
    console.log(
      `[Recompute] Found ${categories.length} categories in database`
    );

    if (isProduction) {
      if (categories.length === 0) {
        throw new Error(
          "No categories found in database. Run migration to seed data."
        );
      }
      const maxDuration = 45;
      const maxExamples = 100;
      return await recomputeEmbeddingsFromDatabase(
        categories,
        getExamplesByCategoryId,
        updateExampleEmbedding,
        { maxDuration, maxExamples }
      );
    }

    // Local development
    if (categories.length > 0) {
      console.log("[Recompute] Using database (local mode)");
      return await recomputeEmbeddingsFromDatabase(
        categories,
        getExamplesByCategoryId,
        updateExampleEmbedding,
        { maxDuration: 300, maxExamples: null }
      );
    }

    console.log(
      "[Recompute] No categories in database, falling back to JSON file"
    );
  } catch (err) {
    if (isProduction) {
      console.error("[Recompute] Database error on production:", err.message);
      throw new Error(`Database error: ${err.message}`);
    }
    console.warn(
      "[Recompute] Database not available, falling back to JSON:",
      err.message
    );
  }

  return await recomputeEmbeddingsFromJSON();
}

/**
 * Recompute embeddings from database
 */
async function recomputeEmbeddingsFromDatabase(
  categories,
  getExamplesByCategoryId,
  updateExampleEmbedding,
  options = {}
) {
  const { maxDuration = 50, maxExamples = null } = options;

  let totalTokens = 0;
  let totalInputTokens = 0;
  let processedCategories = 0;
  let totalExamples = 0;
  let skippedExamples = 0;
  let alreadyComputedTotal = 0;
  const startTime = Date.now();
  const categoryStats = {};

  console.log(
    `[Recompute] Starting... (mode: ${
      USE_LOCAL_EMBEDDINGS ? "LOCAL" : "OpenAI"
    })`
  );
  console.log(`[Recompute] Processing ${categories.length} categories`);
  if (maxExamples)
    console.log(`[Recompute] Limiting to ${maxExamples} examples`);

  const { getUncomputedExamplesByCategoryId } = await import(
    "./db/queries/examples.js"
  );

  for (const category of categories) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > maxDuration) {
      console.warn(`⏱️ Timeout approaching (${elapsed.toFixed(1)}s), stopping`);
      break;
    }

    console.log(
      `[Recompute] Processing: ${category.name} (ID: ${category.id})`
    );

    categoryStats[category.name] = {
      name: category.name,
      total: 0,
      computed: 0,
      alreadyComputed: 0,
      failed: 0,
    };

    const allExamples = await getExamplesByCategoryId(category.id);
    categoryStats[category.name].total = allExamples.length;

    const examples = await getUncomputedExamplesByCategoryId(category.id);
    const alreadyComputed = allExamples.length - examples.length;

    if (alreadyComputed > 0) {
      console.log(
        `[Recompute] Skipping ${alreadyComputed} already-computed examples`
      );
      alreadyComputedTotal += alreadyComputed;
      categoryStats[category.name].alreadyComputed = alreadyComputed;
    }

    if (!examples || examples.length === 0) {
      console.warn(`[Recompute] No examples for category: ${category.name}`);
      continue;
    }

    console.log(`[Recompute] Processing ${examples.length} examples...`);

    for (const example of examples) {
      if (maxExamples && totalExamples >= maxExamples) {
        console.warn(`⏱️ Reached max examples (${maxExamples})`);
        break;
      }

      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > maxDuration) {
        console.warn(`⏱️ Timeout approaching (${elapsed.toFixed(1)}s)`);
        break;
      }

      try {
        const result = await getEmbedding(example.text);
        await updateExampleEmbedding(example.id, result.embedding);

        const tokens = result.usage.total_tokens || 0;
        totalTokens += tokens;
        totalInputTokens += tokens;
        totalExamples++;
        categoryStats[category.name].computed++;

        if (totalExamples % 10 === 0) {
          console.log(
            `[Recompute] Progress: ${totalExamples} examples (${elapsed.toFixed(
              1
            )}s)`
          );
        }
      } catch (err) {
        console.error(
          `[Recompute] Error embedding "${example.text?.substring(0, 50)}...":`,
          err.message
        );
        skippedExamples++;
        categoryStats[category.name].failed++;
      }
    }

    if (
      totalExamples >= (maxExamples || Infinity) ||
      (Date.now() - startTime) / 1000 > maxDuration
    ) {
      break;
    }

    processedCategories++;
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const wasTimeout = elapsed >= maxDuration;
  const wasLimited = maxExamples && totalExamples >= maxExamples;

  // Save and reload embeddings if complete
  if (!wasTimeout && !wasLimited) {
    try {
      const { getAllEmbeddings } = await import("./db/queries/embeddings.js");
      const freshEmbeddings = await getAllEmbeddings();
      if (Object.keys(freshEmbeddings).length > 0) {
        console.log("[Recompute] Saving embeddings to storage...");
        await saveEmbeddings(freshEmbeddings);

        console.log("[Recompute] Reloading from storage...");
        const storageEmbeddings = await reloadFromStorage();

        if (storageEmbeddings && Object.keys(storageEmbeddings).length > 0) {
          console.log(
            `[Recompute] ✅ Refreshed from storage (${
              Object.keys(storageEmbeddings).length
            } categories)`
          );
          await reloadEmbeddings();
        } else {
          console.warn(
            "[Recompute] Failed to reload from storage, using database"
          );
          await reloadEmbeddings();
        }
      }
    } catch (err) {
      console.warn("[Recompute] Failed to save embeddings:", err.message);
      await reloadEmbeddings();
    }
  }

  // Calculate costs (free if using local)
  const embeddingCost = USE_LOCAL_EMBEDDINGS
    ? 0
    : (totalTokens / 1000) * 0.00013;

  let message = wasTimeout
    ? `Processing stopped due to timeout. ${totalExamples} examples processed in ${elapsed.toFixed(
        1
      )}s.`
    : wasLimited
    ? `Processing limited to ${maxExamples} examples. ${totalExamples} examples processed.`
    : alreadyComputedTotal > 0
    ? `Embeddings computed! ${totalExamples} new examples (skipped ${alreadyComputedTotal} already-computed).`
    : "Embeddings recomputed successfully";

  if (USE_LOCAL_EMBEDDINGS && totalExamples > 0) {
    message += " [FREE - using local embeddings]";
  }

  return {
    success: true,
    message,
    labelsProcessed: processedCategories,
    categoryStats,
    totalExamples,
    skippedExamples,
    alreadyComputed: alreadyComputedTotal,
    elapsedSeconds: elapsed.toFixed(1),
    incomplete: wasTimeout || wasLimited,
    persisted: !wasTimeout && !wasLimited,
    usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
    consumption: {
      tokens: {
        input: totalInputTokens,
        output: 0,
        total: totalTokens,
      },
      cost: {
        embeddings: embeddingCost,
        gpt: 0,
        total: embeddingCost,
      },
    },
  };
}

/**
 * Fallback: Recompute embeddings from JSON file
 */
async function recomputeEmbeddingsFromJSON() {
  const labelsPath = path.resolve(projectRoot, "data", "labels.json");

  if (!fs.existsSync(labelsPath)) {
    throw new Error(
      "Labels file not found. Migrate to database or create data/labels.json"
    );
  }

  const labels = JSON.parse(fs.readFileSync(labelsPath, "utf-8"));
  const embeddings = {};
  let totalTokens = 0;
  let totalInputTokens = 0;

  console.log("[Recompute] Starting from JSON file...");
  console.log(
    `[Recompute] Mode: ${
      USE_LOCAL_EMBEDDINGS ? "LOCAL (FREE)" : "OpenAI (PAID)"
    }`
  );

  for (const label of labels) {
    embeddings[label.name] = [];
    console.log(
      `[Recompute] Processing: ${label.name} (${
        label.examples?.length || 0
      } examples)`
    );

    if (!label.examples || label.examples.length === 0) {
      console.warn(`[Recompute] No examples for: ${label.name}`);
      continue;
    }

    for (const example of label.examples) {
      try {
        const result = await getEmbedding(example);
        embeddings[label.name].push({ example, vector: result.embedding });

        const tokens = result.usage.total_tokens || 0;
        totalTokens += tokens;
        totalInputTokens += tokens;
      } catch (err) {
        console.error(`[Recompute] Error embedding "${example}":`, err.message);
      }
    }
  }

  const isReadOnly =
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV ||
    process.env.READ_ONLY_FS === "1";
  const embeddingCost = USE_LOCAL_EMBEDDINGS
    ? 0
    : (totalTokens / 1000) * 0.00013;

  if (isReadOnly) {
    console.warn("⚠️ Read-only environment. Embeddings not persisted.");
    return {
      success: true,
      message:
        "Embeddings recomputed but not persisted (read-only). " +
        (USE_LOCAL_EMBEDDINGS ? "[FREE - using local embeddings]" : ""),
      labelsProcessed: labels.length,
      totalExamples: Object.values(embeddings).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      persisted: false,
      usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
      consumption: {
        tokens: { input: totalInputTokens, output: 0, total: totalTokens },
        cost: { embeddings: embeddingCost, gpt: 0, total: embeddingCost },
      },
    };
  }

  const embeddingsPath = path.resolve(
    projectRoot,
    "src",
    "classifier_embeddings.json"
  );
  const embeddingsDir = path.dirname(embeddingsPath);
  if (!fs.existsSync(embeddingsDir)) {
    fs.mkdirSync(embeddingsDir, { recursive: true });
  }

  try {
    fs.writeFileSync(
      embeddingsPath,
      JSON.stringify(embeddings, null, 2),
      "utf-8"
    );
    console.log(`[Recompute] ✅ Saved to: ${embeddingsPath}`);
    await reloadEmbeddings();

    return {
      success: true,
      message:
        "Embeddings recomputed successfully" +
        (USE_LOCAL_EMBEDDINGS ? " [FREE - using local embeddings]" : ""),
      labelsProcessed: labels.length,
      totalExamples: Object.values(embeddings).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      persisted: true,
      usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
      consumption: {
        tokens: { input: totalInputTokens, output: 0, total: totalTokens },
        cost: { embeddings: embeddingCost, gpt: 0, total: embeddingCost },
      },
    };
  } catch (err) {
    if (err.code === "EROFS") {
      console.warn("⚠️ Read-only filesystem. Embeddings not persisted.");
      return {
        success: true,
        message:
          "Embeddings recomputed but not persisted (read-only)" +
          (USE_LOCAL_EMBEDDINGS ? " [FREE - using local embeddings]" : ""),
        labelsProcessed: labels.length,
        totalExamples: Object.values(embeddings).reduce(
          (sum, arr) => sum + arr.length,
          0
        ),
        persisted: false,
        usingLocalEmbeddings: USE_LOCAL_EMBEDDINGS,
        consumption: {
          tokens: { input: totalInputTokens, output: 0, total: totalTokens },
          cost: { embeddings: embeddingCost, gpt: 0, total: embeddingCost },
        },
      };
    }
    throw err;
  }
}
