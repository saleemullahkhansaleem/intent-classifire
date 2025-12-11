// src/blobService.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { put, head, getDownloadUrl } from "@vercel/blob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const EMBEDDINGS_BLOB_PATH = "intent-classifire-blob/classifier-embeddings.json";
const LOCAL_EMBEDDINGS_FILE = path.resolve(projectRoot, "src", "classifier_embeddings.json");

// Check if in production (Vercel)
const isProduction = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
// Use Blob if token is available (works in both local dev AND production)
// This ensures vector file is ALWAYS stored in Blob, not local filesystem
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

let cachedEmbeddings = null;
let lastLoadTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // Cache for 30 minutes
let debugLogged = false;

// Debug logging for storage mode (deferred to first function call)
function logStorageMode() {
  if (debugLogged) return;
  debugLogged = true;
  if (typeof window === 'undefined') { // Only log on server side
    console.log(`[EmbeddingStorage] Mode: ${useBlob ? 'Blob (BLOB_READ_WRITE_TOKEN available)' : 'Local file (fallback - no Blob token)'}`);
  }
}

/**
 * Load embeddings from appropriate storage (Blob in production, local file in dev)
 */
export async function loadEmbeddingsFromStorage() {
  try {
    logStorageMode(); // Log on first call
    const now = Date.now();

    // Return cached if valid
    if (cachedEmbeddings && (now - lastLoadTime) < CACHE_DURATION) {
      const source = useBlob ? "Blob" : "local file";
      console.log(`[EmbeddingStorage] Using cached embeddings from ${source}`);
      return cachedEmbeddings;
    }

    if (useBlob) {
      return await loadFromBlob();
    } else {
      return await loadFromLocalFile();
    }
  } catch (error) {
    console.error("[EmbeddingStorage] Error loading embeddings:", error.message);
    return null;
  }
}

/**
 * Load from Vercel Blob (production only)
 */
async function loadFromBlob() {
  try {
    console.log("[EmbeddingStorage] Loading embeddings from Vercel Blob...");

    // Check if blob exists
    const blobInfo = await head(EMBEDDINGS_BLOB_PATH).catch(() => null);
    if (!blobInfo) {
      console.warn("[EmbeddingStorage] No embeddings blob found");
      return null;
    }

    // Get download URL and fetch the content
    const { downloadUrl } = await getDownloadUrl(EMBEDDINGS_BLOB_PATH);
    const response = await fetch(downloadUrl);
    const text = await response.text();

    cachedEmbeddings = JSON.parse(text);
    lastLoadTime = Date.now();

    console.log(`[EmbeddingStorage] Loaded from Blob: ${Object.keys(cachedEmbeddings).length} categories`);
    return cachedEmbeddings;
  } catch (error) {
    console.error("[EmbeddingStorage] Blob load failed:", error.message);
    return null;
  }
}

/**
 * Load from local JSON file (development)
 */
async function loadFromLocalFile() {
  try {
    console.log("[EmbeddingStorage] Loading embeddings from local file...");

    if (!fs.existsSync(LOCAL_EMBEDDINGS_FILE)) {
      console.warn("[EmbeddingStorage] No local embeddings file found");
      return null;
    }

    const content = fs.readFileSync(LOCAL_EMBEDDINGS_FILE, "utf-8");
    cachedEmbeddings = JSON.parse(content);
    lastLoadTime = Date.now();

    console.log(`[EmbeddingStorage] Loaded from local: ${Object.keys(cachedEmbeddings).length} categories`);
    return cachedEmbeddings;
  } catch (error) {
    console.error("[EmbeddingStorage] Local file load failed:", error.message);
    return null;
  }
}

/**
 * Save embeddings to appropriate storage (Blob in prod, local file in dev)
 */
export async function saveEmbeddings(embeddings) {
  try {
    if (!embeddings || Object.keys(embeddings).length === 0) {
      throw new Error("No embeddings to save");
    }

    if (useBlob) {
      return await saveToBlob(embeddings);
    } else {
      return await saveToLocalFile(embeddings);
    }
  } catch (error) {
    console.error("[EmbeddingStorage] Error saving embeddings:", error.message);
    return false;
  }
}

/**
 * Save to Vercel Blob (production)
 */
async function saveToBlob(embeddings) {
  try {
    console.log("[EmbeddingStorage] Saving embeddings to Vercel Blob...");
    const jsonContent = JSON.stringify(embeddings, null, 2);

    await put(EMBEDDINGS_BLOB_PATH, jsonContent, {
      contentType: "application/json",
      access: "public",
    });

    cachedEmbeddings = embeddings;
    lastLoadTime = Date.now();

    console.log("[EmbeddingStorage] Saved to Blob successfully");
    return true;
  } catch (error) {
    console.error("[EmbeddingStorage] Blob save failed:", error.message);
    return false;
  }
}

/**
 * Save to local JSON file (development)
 */
async function saveToLocalFile(embeddings) {
  try {
    console.log("[EmbeddingStorage] Saving embeddings to local file...");
    const jsonContent = JSON.stringify(embeddings, null, 2);

    // Ensure directory exists
    const dirPath = path.dirname(LOCAL_EMBEDDINGS_FILE);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(LOCAL_EMBEDDINGS_FILE, jsonContent, "utf-8");

    cachedEmbeddings = embeddings;
    lastLoadTime = Date.now();

    console.log("[EmbeddingStorage] Saved to local file successfully");
    return true;
  } catch (error) {
    console.error("[EmbeddingStorage] Local file save failed:", error.message);
    // On Vercel without Blob token, this will fail - that's expected
    // Embeddings are in the database, will be used on next request
    if (isProduction && !useBlob) {
      console.warn("[EmbeddingStorage] NOTE: Running on Vercel without BLOB_READ_WRITE_TOKEN. " +
        "Embeddings stored in database will be used. Set BLOB_READ_WRITE_TOKEN for better performance.");
    }
    return false;
  }
}

/**
 * Invalidate the in-memory cache (e.g., after recomputation)
 */
export function invalidateCache() {
  cachedEmbeddings = null;
  lastLoadTime = 0;
  console.log("[EmbeddingStorage] Cache invalidated");
}

/**
 * Reload embeddings from storage (called after save to refresh cache)
 */
export async function reloadFromStorage() {
  console.log("[EmbeddingStorage] Reloading embeddings from storage...");
  cachedEmbeddings = null;
  lastLoadTime = 0;
  return await loadEmbeddingsFromStorage();
}

/**
 * Get cached embeddings without reloading
 */
export function getCachedEmbeddings() {
  return cachedEmbeddings;
}
