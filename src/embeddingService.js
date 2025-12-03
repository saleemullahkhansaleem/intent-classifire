// src/embeddingService.js
import 'dotenv/config';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { initClassifier } from "./classifier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root directory (go up from src/)
const projectRoot = path.resolve(__dirname, "..");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OpenAI;

// Get embedding using OpenAI API
async function getEmbedding(text) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-large",
      input: text,
    });

    return response.data[0].embedding;
  } catch (err) {
    console.error(`OpenAI API error for text "${text.substring(0, 50)}...":`, err.message);
    throw err;
  }
}

// Helper function to find labels file using multiple path strategies
function findLabelsFile() {
  const possiblePaths = [
    // Standard path from project root
    path.resolve(projectRoot, "data", "labels.json"),
    // Path relative to current working directory (for Vercel)
    path.resolve(process.cwd(), "data", "labels.json"),
    // Path from __dirname (current file location)
    path.resolve(__dirname, "..", "data", "labels.json"),
    // Absolute path fallback for Vercel
    "/vercel/path0/data/labels.json",
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

// Helper function to find embeddings file using multiple path strategies
function findEmbeddingsFile() {
  const possiblePaths = [
    // Standard path from project root
    path.resolve(projectRoot, "src", "classifier_embeddings.json"),
    // Path relative to current working directory (for Vercel)
    path.resolve(process.cwd(), "src", "classifier_embeddings.json"),
    // Path from __dirname (current file location)
    path.resolve(__dirname, "classifier_embeddings.json"),
    // Absolute path fallback for Vercel
    "/vercel/path0/src/classifier_embeddings.json",
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // If not found, return default path for writing
  return path.resolve(projectRoot, "src", "classifier_embeddings.json");
}

// Recompute embeddings for all labels
export async function recomputeEmbeddings() {
  try {
    const labelsPath = findLabelsFile();

    if (!labelsPath) {
      throw new Error(
        "Labels file not found. Please ensure data/labels.json exists in the project."
      );
    }

    const labels = JSON.parse(fs.readFileSync(labelsPath, "utf-8"));
    const embeddings = {};

    console.log("Starting embedding recomputation...");
    console.log(`Labels file: ${labelsPath}`);

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not set. Please set it in your .env file.");
    }

    for (const label of labels) {
      embeddings[label.name] = [];
      console.log(
        `Processing label: ${label.name} (${label.examples?.length || 0} examples)`
      );

      if (!label.examples || label.examples.length === 0) {
        console.warn(`No examples found for label: ${label.name}`);
        continue;
      }

      for (const example of label.examples) {
        try {
          const vector = await getEmbedding(example);
          embeddings[label.name].push({ example, vector });
        } catch (err) {
          console.error(`Error embedding example "${example}":`, err.message);
          // Continue with other examples
        }
      }
    }

    const embeddingsPath = findEmbeddingsFile();

    // Ensure directory exists
    const embeddingsDir = path.dirname(embeddingsPath);
    if (!fs.existsSync(embeddingsDir)) {
      fs.mkdirSync(embeddingsDir, { recursive: true });
    }

    fs.writeFileSync(
      embeddingsPath,
      JSON.stringify(embeddings, null, 2),
      "utf-8"
    );

    console.log("Embeddings recomputed successfully!");
    console.log(`Embeddings saved to: ${embeddingsPath}`);

    // Reload embeddings in classifier
    initClassifier({ openaiApiKey: OPENAI_API_KEY });

    const totalExamples = Object.values(embeddings).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    return {
      success: true,
      message: "Embeddings recomputed successfully",
      labelsProcessed: labels.length,
      totalExamples: totalExamples,
    };
  } catch (err) {
    console.error("Error recomputing embeddings:", err);
    console.error("Stack trace:", err.stack);
    throw new Error(`Failed to recompute embeddings: ${err.message}`);
  }
}

