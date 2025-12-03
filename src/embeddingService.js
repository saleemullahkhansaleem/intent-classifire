// src/embeddingService.js
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { initClassifier } from "./classifier.js";
import { readLabels, writeEmbeddings } from "./storage.js";

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
    console.error(
      `OpenAI API error for text "${text.substring(0, 50)}...":`,
      err.message
    );
    throw err;
  }
}

// Recompute embeddings for all labels
export async function recomputeEmbeddings() {
  try {
    // Read labels from storage (file system or Blob Storage)
    const labels = await readLabels();
    const embeddings = {};

    console.log("Starting embedding recomputation...");
    console.log(`Processing ${labels.length} labels`);

    if (!OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY not set. Please set it in your .env file."
      );
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
          const vector = await getEmbedding(example);
          embeddings[label.name].push({ example, vector });
        } catch (err) {
          console.error(`Error embedding example "${example}":`, err.message);
          // Continue with other examples
        }
      }
    }

    // Write embeddings to storage (file system or Blob Storage)
    const writeResult = await writeEmbeddings(embeddings);

    if (writeResult.persisted) {
      console.log("Embeddings recomputed and saved successfully!");
      if (writeResult.url) {
        console.log(`Embeddings saved to Blob Storage: ${writeResult.url}`);
      }

      // Reload embeddings in classifier
      await initClassifier({ openaiApiKey: OPENAI_API_KEY });

      const totalExamples = Object.values(embeddings).reduce(
        (sum, arr) => sum + arr.length,
        0
      );

      return {
        success: true,
        message: "Embeddings recomputed successfully",
        labelsProcessed: labels.length,
        totalExamples: totalExamples,
        persisted: true,
      };
    } else {
      console.warn(
        "⚠️  Embeddings computed but not persisted. " +
          "They will be computed on-demand during classification."
      );
      return {
        success: true,
        message:
          "Embeddings recomputed but not persisted. " +
          "Embeddings will be computed on-demand during classification.",
        labelsProcessed: labels.length,
        totalExamples: Object.values(embeddings).reduce(
          (sum, arr) => sum + arr.length,
          0
        ),
        persisted: false,
      };
    }
  } catch (err) {
    console.error("Error recomputing embeddings:", err);
    console.error("Stack trace:", err.stack);
    throw new Error(`Failed to recompute embeddings: ${err.message}`);
  }
}
