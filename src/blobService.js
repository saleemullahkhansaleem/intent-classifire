// src/blobService.js
// Vercel Blob storage for embedding vectors
// Production: Uses Blob storage
// Development: Also uses Blob if token available, otherwise fails gracefully

import { put, head, getDownloadUrl } from "@vercel/blob";

const EMBEDDINGS_BLOB_PATH = "intent-classifire-blob/classifier-embeddings.json";

// Verify Blob token is available
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

let cachedEmbeddings = null;
let lastLoadTime = 0;
// Cache example embeddings in memory - persist until server restart
// User input embeddings are computed fresh each request (not cached)
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes, but typically persists until server restart
let debugLogged = false;

// Debug logging for storage mode
function logStorageMode() {
  if (debugLogged) return;
  debugLogged = true;
  if (typeof window === 'undefined') { // Server-side only
    if (BLOB_TOKEN) {
      console.log("[EmbeddingStorage] Mode: Blob storage (BLOB_READ_WRITE_TOKEN available)");
    } else {
      console.log("[EmbeddingStorage] WARNING: No BLOB_READ_WRITE_TOKEN. Embeddings will not persist.");
    }
  }
}

/**
 * Load embeddings from Vercel Blob storage
 * Returns cached result if within TTL
 */
export async function loadEmbeddingsFromStorage() {
  try {
    logStorageMode();
    const now = Date.now();

    // Return cached if valid
    if (cachedEmbeddings && (now - lastLoadTime) < CACHE_DURATION) {
      console.log("[EmbeddingStorage] Using cached embeddings from memory");
      return cachedEmbeddings;
    }

    return await loadFromBlob();
  } catch (error) {
    console.error("[EmbeddingStorage] Error loading embeddings:", error.message);
    return null;
  }
}

/**
 * Load embeddings from Vercel Blob
 */
async function loadFromBlob() {
  try {
    if (!BLOB_TOKEN) {
      console.warn("[EmbeddingStorage] No BLOB_READ_WRITE_TOKEN available");
      return null;
    }

    console.log("[EmbeddingStorage] Loading embeddings from Vercel Blob...");

    // Check if blob exists
    const blobInfo = await head(EMBEDDINGS_BLOB_PATH).catch(() => null);
    if (!blobInfo) {
      console.warn("[EmbeddingStorage] No embeddings blob found");
      return null;
    }

    // Get download URL and fetch content
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
 * Save embeddings to Vercel Blob storage
 */
export async function saveEmbeddings(embeddings) {
  try {
    if (!embeddings || Object.keys(embeddings).length === 0) {
      throw new Error("No embeddings to save");
    }

    if (!BLOB_TOKEN) {
      console.warn("[EmbeddingStorage] No BLOB_READ_WRITE_TOKEN - cannot save to Blob");
      return false;
    }

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
 * Invalidate in-memory cache (called after recomputation)
 */
export function invalidateCache() {
  cachedEmbeddings = null;
  lastLoadTime = 0;
  console.log("[EmbeddingStorage] Cache invalidated");
}

/**
 * Reload embeddings from Blob storage and update cache
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
