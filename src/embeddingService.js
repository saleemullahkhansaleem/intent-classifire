// src/embeddingService.js
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { reloadEmbeddings } from "./classifier.js";

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

    await initDatabase();
    const categories = await getAllCategories();

    if (categories.length > 0) {
      // Use database
      return await recomputeEmbeddingsFromDatabase(
        categories,
        getExamplesByCategoryId,
        updateExampleEmbedding
      );
    }
  } catch (err) {
    console.warn("Database not available, falling back to JSON:", err.message);
  }

  // Fallback to JSON file
  return await recomputeEmbeddingsFromJSON();
}

// Recompute embeddings from database
async function recomputeEmbeddingsFromDatabase(
  categories,
  getExamplesByCategoryId,
  updateExampleEmbedding
) {
  // Consumption tracking
  let totalTokens = 0;
  let totalInputTokens = 0;
  let processedCategories = 0;
  let totalExamples = 0;

  console.log("Starting embedding recomputation from database...");
  console.log(`Processing ${categories.length} categories`);

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set. Please set it in your .env file.");
  }

  for (const category of categories) {
    console.log(`Processing category: ${category.name} (ID: ${category.id})`);

    const examples = await getExamplesByCategoryId(category.id);

    if (!examples || examples.length === 0) {
      console.warn(`No examples found for category: ${category.name}`);
      continue;
    }

    console.log(`  Processing ${examples.length} examples...`);

    for (const example of examples) {
      try {
        const result = await getEmbedding(example.text);
        await updateExampleEmbedding(example.id, result.embedding);

        // Track consumption
        const tokens = result.usage.total_tokens || 0;
        totalTokens += tokens;
        totalInputTokens += tokens;
        totalExamples++;
      } catch (err) {
        console.error(
          `Error embedding example "${example.text?.substring(0, 50)}...":`,
          err.message
        );
        // Continue with other examples
      }
    }

    processedCategories++;
  }

  // Reload embeddings in classifier
  await reloadEmbeddings();

  // Calculate consumption costs
  const embeddingCost = (totalTokens / 1000) * 0.00013;

  return {
    success: true,
    message: "Embeddings recomputed successfully from database",
    labelsProcessed: processedCategories,
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
      `Processing label: ${label.name} (${
        label.examples?.length || 0
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
