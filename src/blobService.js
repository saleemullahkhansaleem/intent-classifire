// src/blobService.js
// Vercel Blob storage for embedding vectors
// Production: Uses Blob storage
// Development: Also uses Blob if token available, otherwise fails gracefully

import { put, head } from "@vercel/blob";

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
    console.log(`[EmbeddingStorage] Blob path: ${EMBEDDINGS_BLOB_PATH}`);

    // Step 1: Check if blob exists
    let blobInfo = null;
    try {
      blobInfo = await head(EMBEDDINGS_BLOB_PATH);
      console.log(`[EmbeddingStorage] Blob exists, info:`, {
        size: blobInfo.size,
        uploadedAt: blobInfo.uploadedAt,
        hasDownloadUrl: !!blobInfo.downloadUrl,
        hasUrl: !!blobInfo.url,
      });
    } catch (headError) {
      console.warn(`[EmbeddingStorage] Blob not found (head check):`, headError.message);
      return null;
    }

    // Step 2: Get download URL from blob info or construct it
    let downloadUrl = null;

    // Try blobInfo.downloadUrl first (primary method from head())
    if (blobInfo && blobInfo.downloadUrl) {
      downloadUrl = blobInfo.downloadUrl;
      console.log(`[EmbeddingStorage] Using downloadUrl from head() response`);
    }
    // Fallback: try blobInfo.url (alternative property name)
    else if (blobInfo && blobInfo.url) {
      downloadUrl = blobInfo.url;
      console.log(`[EmbeddingStorage] Using url from head() response`);
    }
    // Last resort: construct URL from blob path
    // Vercel Blob URLs typically follow pattern: https://blob.vercelusercontent.com/...
    else {
      console.warn(`[EmbeddingStorage] No URL in blob info, trying to construct URL`);
      return null;
    }

    if (!downloadUrl) {
      console.error("[EmbeddingStorage] Could not determine download URL", { blobInfo });
      return null;
    }

    console.log(`[EmbeddingStorage] Fetching from: ${downloadUrl.substring(0, 100)}...`);

    // Step 3: Fetch the blob content
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      console.error(
        `[EmbeddingStorage] Fetch failed with status ${response.status}: ${response.statusText}`,
        `URL: ${downloadUrl.substring(0, 100)}...`
      );
      return null;
    }

    const text = await response.text();

    if (!text || text.length === 0) {
      console.warn("[EmbeddingStorage] Blob content is empty");
      return null;
    }

    // Step 4: Parse JSON
    try {
      cachedEmbeddings = JSON.parse(text);
    } catch (parseError) {
      console.error("[EmbeddingStorage] Failed to parse JSON from blob:", parseError.message);
      console.error("[EmbeddingStorage] First 200 chars:", text.substring(0, 200));
      return null;
    }

    lastLoadTime = Date.now();

    const categoryCount = Object.keys(cachedEmbeddings).length;
    const totalEmbeddings = Object.values(cachedEmbeddings).reduce(
      (sum, examples) => sum + (Array.isArray(examples) ? examples.length : 0),
      0
    );

    console.log(`[EmbeddingStorage] ✅ Loaded from Blob: ${categoryCount} categories, ${totalEmbeddings} embeddings`);
    return cachedEmbeddings;
  } catch (error) {
    console.error("[EmbeddingStorage] Blob load failed:", error.message);
    if (error.stack) {
      console.error("[EmbeddingStorage] Stack trace:", error.stack);
    }
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

    const categoryCount = Object.keys(embeddings).length;
    const totalEmbeddings = Object.values(embeddings).reduce(
      (sum, examples) => sum + (Array.isArray(examples) ? examples.length : 0),
      0
    );

    console.log(`[EmbeddingStorage] Saving embeddings to Vercel Blob...`);
    console.log(`[EmbeddingStorage] Data: ${categoryCount} categories, ${totalEmbeddings} embeddings`);

    const jsonContent = JSON.stringify(embeddings, null, 2);
    const sizeInMB = (jsonContent.length / (1024 * 1024)).toFixed(2);
    console.log(`[EmbeddingStorage] JSON size: ${sizeInMB} MB`);

    const putResult = await put(EMBEDDINGS_BLOB_PATH, jsonContent, {
      contentType: "application/json",
      access: "public",
    });

    console.log(`[EmbeddingStorage] Put result:`, {
      url: putResult.url ? putResult.url.substring(0, 100) + "..." : "N/A",
      size: putResult.size,
      uploadedAt: putResult.uploadedAt,
    });

    cachedEmbeddings = embeddings;
    lastLoadTime = Date.now();

    console.log(`[EmbeddingStorage] ✅ Saved to Blob successfully (${sizeInMB} MB)`);
    return true;
  } catch (error) {
    console.error("[EmbeddingStorage] Blob save failed:", error.message);
    if (error.stack) {
      console.error("[EmbeddingStorage] Stack trace:", error.stack);
    }
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
