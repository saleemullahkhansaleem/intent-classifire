// src/blobService.js
// Vercel Blob storage for embedding vectors - simple, production-focused

import { put, head } from "@vercel/blob";

const EMBEDDINGS_BLOB_PATH = "intent-classifire-blob/classifier-embeddings.json";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

let cachedEmbeddings = null;

/**
 * Load embeddings from Vercel Blob storage
 * Returns cached version if available
 */
export async function loadEmbeddingsFromStorage() {
  // Return cached if available
  if (cachedEmbeddings && Object.keys(cachedEmbeddings).length > 0) {
    console.log(`[Blob] Using cached embeddings (${Object.keys(cachedEmbeddings).length} categories)`);
    return cachedEmbeddings;
  }

  if (!BLOB_TOKEN) {
    console.warn("[Blob] No BLOB_READ_WRITE_TOKEN available");
    return null;
  }

  try {
    console.log("[Blob] Loading embeddings from Vercel Blob...");
    return await loadFromBlob();
  } catch (error) {
    console.error("[Blob] Error loading embeddings:", error.message);
    return null;
  }
}

/**
 * Load embeddings from Vercel Blob
 */
async function loadFromBlob() {
  try {
    // Check if blob exists
    let blobInfo;
    try {
      blobInfo = await head(EMBEDDINGS_BLOB_PATH);
    } catch (headError) {
      console.warn(`[Blob] Blob not found:`, headError.message);
      return null;
    }

    // Get download URL
    const downloadUrl = blobInfo.downloadUrl || blobInfo.url;
    if (!downloadUrl) {
      console.error("[Blob] No URL available in blob info");
      return null;
    }

    // Fetch and parse blob content
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      console.error(`[Blob] Fetch failed with status ${response.status}`);
      return null;
    }

    const text = await response.text();
    if (!text) {
      console.warn("[Blob] Blob content is empty");
      return null;
    }

    cachedEmbeddings = JSON.parse(text);
    const categoryCount = Object.keys(cachedEmbeddings).length;
    const totalExamples = Object.values(cachedEmbeddings).reduce(
      (sum, exs) => sum + (Array.isArray(exs) ? exs.length : 0),
      0
    );
    console.log(`[Blob] ✅ Loaded ${categoryCount} categories, ${totalExamples} examples`);
    return cachedEmbeddings;
  } catch (error) {
    console.error("[Blob] Load failed:", error.message);
    return null;
  }
}/**
 * Save embeddings to Vercel Blob storage
 */
export async function saveEmbeddings(embeddings) {
  if (!embeddings || Object.keys(embeddings).length === 0) {
    throw new Error("No embeddings to save");
  }

  if (!BLOB_TOKEN) {
    console.warn("[Blob] No BLOB_READ_WRITE_TOKEN - cannot save to Blob");
    return false;
  }

  try {
    const categoryCount = Object.keys(embeddings).length;
    const totalExamples = Object.values(embeddings).reduce(
      (sum, exs) => sum + (Array.isArray(exs) ? exs.length : 0),
      0
    );

    console.log(`[Blob] Saving ${categoryCount} categories, ${totalExamples} examples...`);
    const jsonContent = JSON.stringify(embeddings, null, 2);

    await put(EMBEDDINGS_BLOB_PATH, jsonContent, {
      contentType: "application/json",
      access: "public",
    });

    cachedEmbeddings = embeddings;
    console.log(`[Blob] ✅ Saved successfully (${(jsonContent.length / 1024 / 1024).toFixed(2)} MB)`);
    return true;
  } catch (error) {
    console.error("[Blob] Save failed:", error.message);
    return false;
  }
}

/**
 * Invalidate in-memory cache (called before reload)
 */
export function invalidateCache() {
  cachedEmbeddings = null;
  console.log("[Blob] Cache invalidated");
}

/**
 * Reload embeddings from Blob storage (forced fresh load)
 */
export async function reloadFromStorage() {
  console.log("[Blob] Reloading from storage...");
  cachedEmbeddings = null; // Clear cache first
  return await loadFromBlob();
}

/**
 * Get cached embeddings without reloading
 */
export function getCachedEmbeddings() {
  return cachedEmbeddings;
}
