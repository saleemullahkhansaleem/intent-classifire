// src/embeddingService.js
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { reloadEmbeddings } from "./classifier.js";
import { saveEmbeddings, invalidateCache } from "./classifier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root directory (go up from src/)
const projectRoot = path.resolve(__dirname, "..");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.Openai;

// Get embedding using OpenAI API (returns embedding and usage)
async function getEmbedding(text) {
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
      `OpenAI API error for text "${text.substring(0, 50)}...":`,
      err.message
    );
    throw err;
  }
}

// Recompute embeddings - tries database first, falls back to JSON
export async function recomputeEmbeddings() {
  // Check if we're in a production/Vercel environment
  const isProduction =
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;

  console.log(
    `[Recompute] Environment: ${isProduction ? "Production/Vercel" : "Local Development"
    }`
  );

  // Try database first (always on production/Vercel)
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

    // On production/Vercel, always use database (don't fall back to JSON)
    if (isProduction) {
      if (categories.length === 0) {
        throw new Error(
          "No categories found in database. Please ensure POSTGRES_URL is set in Vercel environment variables and run the migration to seed data from labels.json."
        );
      }
      console.log(
        "[Recompute] Using database for embedding recomputation (production mode)"
      );
      // Use database with timeout limits for Vercel
      // Vercel Hobby: 10s, Pro: 60s - we'll use 45s to be safe
      const maxDuration = 45; // Leave buffer for response time
      const maxExamples = 100; // Process max 100 examples per request to avoid timeout
      return await recomputeEmbeddingsFromDatabase(
        categories,
        getExamplesByCategoryId,
        updateExampleEmbedding,
        { maxDuration, maxExamples }
      );
    }

    // Local development: use database if it has data, otherwise fall back to JSON
    if (categories.length > 0) {
      console.log(
        "[Recompute] Using database for embedding recomputation (local mode)"
      );
      // No limits for local development
      return await recomputeEmbeddingsFromDatabase(
        categories,
        getExamplesByCategoryId,
        updateExampleEmbedding,
        { maxDuration: 300, maxExamples: null } // 5 minutes for local
      );
    }

    console.log(
      "[Recompute] No categories in database, falling back to JSON file (local mode)"
    );
  } catch (err) {
    // On production/Vercel, don't fall back to JSON - fail with clear error
    if (isProduction) {
      console.error("[Recompute] Database error on Vercel:", err.message);
      throw new Error(
        `Database error on Vercel: ${err.message}. Please ensure POSTGRES_URL is set in Vercel environment variables and data has been migrated.`
      );
    }
    console.warn(
      "[Recompute] Database not available, falling back to JSON:",
      err.message
    );
  }

  // Fallback to JSON file (only in local development)
  return await recomputeEmbeddingsFromJSON();
}

// Recompute embeddings from database
async function recomputeEmbeddingsFromDatabase(
  categories,
  getExamplesByCategoryId,
  updateExampleEmbedding,
  options = {}
) {
  const { maxDuration = 50, maxExamples = null } = options; // Default 50s to leave buffer for response

  // Consumption tracking
  let totalTokens = 0;
  let totalInputTokens = 0;
  let processedCategories = 0;
  let totalExamples = 0;
  let skippedExamples = 0;
  let alreadyComputedTotal = 0;
  const startTime = Date.now();

  // Per-category stats
  const categoryStats = {};

  console.log("Starting embedding recomputation from database...");
  console.log(`Processing ${categories.length} categories`);
  if (maxExamples) {
    console.log(
      `Limiting to ${maxExamples} examples per request to avoid timeout`
    );
  }

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set. Please set it in your .env file.");
  }

  // Import getUncomputedExamplesByCategoryId to skip already-computed examples
  const { getUncomputedExamplesByCategoryId } = await import(
    "./db/queries/examples.js"
  );

  for (const category of categories) {
    // Check timeout (leave 2 seconds buffer for response)
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > maxDuration) {
      console.warn(
        `⏱️ Timeout approaching (${elapsed.toFixed(1)}s), stopping processing`
      );
      break;
    }

    console.log(`Processing category: ${category.name} (ID: ${category.id})`);

    // Initialize category stats
    categoryStats[category.name] = {
      name: category.name,
      total: 0,
      computed: 0,
      alreadyComputed: 0,
      failed: 0
    };

    // Get all examples to count already-computed ones
    const allExamples = await getExamplesByCategoryId(category.id);
    categoryStats[category.name].total = allExamples.length;

    // Only process uncomputed examples
    const examples = await getUncomputedExamplesByCategoryId(category.id);
    const alreadyComputed = allExamples.length - examples.length;

    if (alreadyComputed > 0) {
      console.log(`Skipping ${alreadyComputed} already-computed examples for ${category.name}`);
      alreadyComputedTotal += alreadyComputed;
      categoryStats[category.name].alreadyComputed = alreadyComputed;
    }

    if (!examples || examples.length === 0) {
      console.warn(`No examples found for category: ${category.name}`);
      continue;
    }

    console.log(`  Processing ${examples.length} examples...`);

    for (const example of examples) {
      // Check max examples limit
      if (maxExamples && totalExamples >= maxExamples) {
        console.warn(
          `⏱️ Reached max examples limit (${maxExamples}), stopping processing`
        );
        break;
      }

      // Check timeout before each API call
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > maxDuration) {
        console.warn(
          `⏱️ Timeout approaching (${elapsed.toFixed(1)}s), stopping processing`
        );
        break;
      }

      try {
        const result = await getEmbedding(example.text);
        await updateExampleEmbedding(example.id, result.embedding);

        // Track consumption
        const tokens = result.usage.total_tokens || 0;
        totalTokens += tokens;
        totalInputTokens += tokens;
        totalExamples++;
        categoryStats[category.name].computed++;

        // Log progress every 10 examples
        if (totalExamples % 10 === 0) {
          console.log(
            `  Progress: ${totalExamples} examples processed (${elapsed.toFixed(
              1
            )}s elapsed)`
          );
        }
      } catch (err) {
        console.error(
          `Error embedding example "${example.text?.substring(0, 50)}...":`,
          err.message
        );
        skippedExamples++;
        categoryStats[category.name].failed++;
        // Continue with other examples
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

  // Only reload embeddings if we completed processing
  if (!wasTimeout && !wasLimited) {
    // Save embeddings to storage (Blob on prod, local file in dev)
    try {
      const { getAllEmbeddings } = await import("./db/queries/embeddings.js");
      const freshEmbeddings = await getAllEmbeddings();
      if (Object.keys(freshEmbeddings).length > 0) {
        await saveEmbeddings(freshEmbeddings);
        // Invalidate in-memory cache so next load gets fresh data
        invalidateCache();
        // Force reload from fresh storage to update classifier's embeddings variable
        console.log("[Recompute] Forcing embeddings reload after save...");
        await reloadEmbeddings();
      }
    } catch (err) {
      console.warn("[Recompute] Failed to save embeddings:", err.message);
      // Continue anyway - embeddings are in database
    }
  }

  // Calculate consumption costs
  const embeddingCost = (totalTokens / 1000) * 0.00013;

  let message = wasTimeout
    ? `Processing stopped due to timeout. ${totalExamples} examples processed in ${elapsed.toFixed(
      1
    )}s. Please run again to process remaining examples.`
    : wasLimited
      ? `Processing limited to ${maxExamples} examples. ${totalExamples} examples processed. Please run again to process remaining examples.`
      : alreadyComputedTotal > 0
        ? `Embeddings computed successfully! Computed ${totalExamples} new examples (skipped ${alreadyComputedTotal} already-computed).`
        : "Embeddings recomputed successfully from database";

  return {
    success: true,
    message,
    labelsProcessed: processedCategories,
    categoryStats: categoryStats,
    totalExamples: totalExamples,
    skippedExamples: skippedExamples,
    alreadyComputed: alreadyComputedTotal,
    elapsedSeconds: elapsed.toFixed(1),
    incomplete: wasTimeout || wasLimited,
    persisted: !wasTimeout && !wasLimited,
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

// Fallback: Recompute embeddings from JSON file
async function recomputeEmbeddingsFromJSON() {
  const labelsPath = path.resolve(projectRoot, "data", "labels.json");

  if (!fs.existsSync(labelsPath)) {
    throw new Error(
      "Labels file not found. Please ensure data/labels.json exists or migrate to database."
    );
  }

  const labels = JSON.parse(fs.readFileSync(labelsPath, "utf-8"));
  const embeddings = {};

  // Consumption tracking
  let totalTokens = 0;
  let totalInputTokens = 0;

  console.log("Starting embedding recomputation from JSON file...");
  console.log(`Labels file: ${labelsPath}`);

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set. Please set it in your .env file.");
  }

  for (const label of labels) {
    embeddings[label.name] = [];
    console.log(
      `Processing label: ${label.name} (${label.examples?.length || 0
      } examples)`
    );

    if (!label.examples || label.examples.length === 0) {
      console.warn(`No examples found for label: ${label.name}`);
      continue;
    }

    for (const example of label.examples) {
      try {
        const result = await getEmbedding(example);
        embeddings[label.name].push({ example, vector: result.embedding });

        // Track consumption
        const tokens = result.usage.total_tokens || 0;
        totalTokens += tokens;
        totalInputTokens += tokens;
      } catch (err) {
        console.error(`Error embedding example "${example}":`, err.message);
        // Continue with other examples
      }
    }
  }

  // Check if we're in a read-only environment
  const isReadOnly =
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV ||
    process.env.READ_ONLY_FS === "1";

  if (isReadOnly) {
    console.warn(
      "⚠️  Running in read-only environment (Vercel). " +
      "Embeddings cannot be saved to disk. " +
      "They will be computed on-demand or you can precompute them during build."
    );
    const embeddingCost = (totalTokens / 1000) * 0.00013;

    return {
      success: true,
      message:
        "Embeddings recomputed but not persisted (read-only environment). " +
        "Embeddings will be computed on-demand during classification.",
      labelsProcessed: labels.length,
      totalExamples: Object.values(embeddings).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      persisted: false,
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

  const embeddingsPath = path.resolve(
    projectRoot,
    "src",
    "classifier_embeddings.json"
  );

  // Ensure directory exists
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

    console.log("Embeddings recomputed successfully!");
    console.log(`Embeddings saved to: ${embeddingsPath}`);

    // Reload embeddings in classifier
    await reloadEmbeddings();

    const totalExamples = Object.values(embeddings).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    const embeddingCost = (totalTokens / 1000) * 0.00013;

    return {
      success: true,
      message: "Embeddings recomputed successfully",
      labelsProcessed: labels.length,
      totalExamples: totalExamples,
      persisted: true,
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
  } catch (err) {
    if (err.code === "EROFS") {
      console.warn(
        "⚠️  File system is read-only. Embeddings cannot be saved. " +
        "They will be computed on-demand during classification."
      );
      const embeddingCost = (totalTokens / 1000) * 0.00013;

      return {
        success: true,
        message:
          "Embeddings recomputed but not persisted (read-only filesystem). " +
          "Embeddings will be computed on-demand during classification.",
        labelsProcessed: labels.length,
        totalExamples: Object.values(embeddings).reduce(
          (sum, arr) => sum + arr.length,
          0
        ),
        persisted: false,
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
    throw err;
  }
}
