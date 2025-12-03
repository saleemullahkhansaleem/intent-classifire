// src/storage.js
// Storage abstraction that uses Vercel Blob Storage in production and file system in development
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { put, get, del, list } from "@vercel/blob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Check if we're in a read-only environment (like Vercel serverless)
function isReadOnlyEnvironment() {
  return (
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV ||
    process.env.READ_ONLY_FS === "1"
  );
}

// Check if BLOB_READ_WRITE_TOKEN is available
function hasBlobToken() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// Helper function to find labels file using multiple path strategies
function findLabelsFile() {
  const possiblePaths = [
    path.resolve(projectRoot, "data", "labels.json"),
    path.resolve(process.cwd(), "data", "labels.json"),
    path.resolve(__dirname, "..", "data", "labels.json"),
    "/vercel/path0/data/labels.json",
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

// Storage keys for Blob Storage
const BLOB_KEYS = {
  labels: "labels.json",
  embeddings: "classifier_embeddings.json",
};

// Read labels from storage
export async function readLabels() {
  // In production with Blob Storage available, use Blob Storage
  if (isReadOnlyEnvironment() && hasBlobToken()) {
    try {
      const blob = await get(BLOB_KEYS.labels);
      return JSON.parse(blob);
    } catch (err) {
      // If blob doesn't exist, try to read from file system (fallback to git)
      console.warn("Blob not found, falling back to file system:", err.message);
      const labelsPath = findLabelsFile();
      if (labelsPath) {
        const data = fs.readFileSync(labelsPath, "utf-8");
        return JSON.parse(data);
      }
      throw new Error("Labels not found in Blob Storage or file system");
    }
  }

  // In development or without Blob token, use file system
  const labelsPath = findLabelsFile();
  if (!labelsPath) {
    throw new Error(
      "Labels file not found. Please ensure data/labels.json exists in the project."
    );
  }

  try {
    const data = fs.readFileSync(labelsPath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading labels:", err);
    throw new Error(`Failed to read labels file: ${err.message}`);
  }
}

// Write labels to storage
export async function writeLabels(labels) {
  // In production with Blob Storage available, use Blob Storage
  if (isReadOnlyEnvironment() && hasBlobToken()) {
    try {
      const blob = await put(
        BLOB_KEYS.labels,
        JSON.stringify(labels, null, 2),
        {
          access: "public",
          contentType: "application/json",
        }
      );
      console.log("Labels saved to Blob Storage:", blob.url);
      return true;
    } catch (err) {
      console.error("Error writing to Blob Storage:", err);
      throw new Error(`Failed to write labels to Blob Storage: ${err.message}`);
    }
  }

  // In development, use file system
  const labelsPath = findLabelsFile();
  if (!labelsPath) {
    const defaultPath = path.resolve(projectRoot, "data", "labels.json");
    try {
      const dir = path.dirname(defaultPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(defaultPath, JSON.stringify(labels, null, 2), "utf-8");
      return true;
    } catch (err) {
      if (err.code === "EROFS") {
        throw new Error(
          "File system is read-only. Please set BLOB_READ_WRITE_TOKEN environment variable to use Blob Storage."
        );
      }
      throw new Error(`Failed to write labels file: ${err.message}`);
    }
  }

  try {
    fs.writeFileSync(labelsPath, JSON.stringify(labels, null, 2), "utf-8");
    return true;
  } catch (err) {
    if (err.code === "EROFS") {
      throw new Error(
        "File system is read-only. Please set BLOB_READ_WRITE_TOKEN environment variable to use Blob Storage."
      );
    }
    throw new Error(`Failed to write labels file: ${err.message}`);
  }
}

// Read embeddings from storage
export async function readEmbeddings() {
  // In production with Blob Storage available, use Blob Storage
  if (isReadOnlyEnvironment() && hasBlobToken()) {
    try {
      const blob = await get(BLOB_KEYS.embeddings);
      return JSON.parse(blob);
    } catch (err) {
      // If blob doesn't exist, try to read from file system (fallback to git)
      console.warn(
        "Embeddings blob not found, falling back to file system:",
        err.message
      );
      return null; // Return null to indicate not found
    }
  }

  // In development, use file system
  const possiblePaths = [
    path.resolve(projectRoot, "src", "classifier_embeddings.json"),
    path.resolve(process.cwd(), "src", "classifier_embeddings.json"),
    path.resolve(__dirname, "classifier_embeddings.json"),
    "/vercel/path0/src/classifier_embeddings.json",
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p, "utf-8");
        return JSON.parse(data);
      } catch (err) {
        console.warn("Error reading embeddings from", p, err.message);
      }
    }
  }

  return null;
}

// Write embeddings to storage
export async function writeEmbeddings(embeddings) {
  // In production with Blob Storage available, use Blob Storage
  if (isReadOnlyEnvironment() && hasBlobToken()) {
    try {
      const blob = await put(
        BLOB_KEYS.embeddings,
        JSON.stringify(embeddings, null, 2),
        {
          access: "public",
          contentType: "application/json",
        }
      );
      console.log("Embeddings saved to Blob Storage:", blob.url);
      return { persisted: true, url: blob.url };
    } catch (err) {
      console.error("Error writing embeddings to Blob Storage:", err);
      return { persisted: false, error: err.message };
    }
  }

  // In development, use file system
  const embeddingsPath = path.resolve(
    projectRoot,
    "src",
    "classifier_embeddings.json"
  );
  try {
    const embeddingsDir = path.dirname(embeddingsPath);
    if (!fs.existsSync(embeddingsDir)) {
      fs.mkdirSync(embeddingsDir, { recursive: true });
    }
    fs.writeFileSync(
      embeddingsPath,
      JSON.stringify(embeddings, null, 2),
      "utf-8"
    );
    return { persisted: true };
  } catch (err) {
    if (err.code === "EROFS") {
      console.warn("File system is read-only. Embeddings not persisted.");
      return { persisted: false, error: "Read-only filesystem" };
    }
    throw new Error(`Failed to write embeddings: ${err.message}`);
  }
}
