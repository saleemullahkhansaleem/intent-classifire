// src/db/queries/embeddings.js
// Embedding storage and retrieval queries

import { getDb } from "../database.js";
import crypto from "crypto";

/**
 * Generate hash for text
 */
function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Store embedding in cache
 */
export async function cacheEmbedding(text, embedding, modelName) {
  const db = getDb();
  const textHash = hashText(text);
  const embeddingJson = JSON.stringify(embedding);

  try {
    await db.execute(
      `INSERT INTO embeddings_cache (text_hash, embedding, model_name)
       VALUES ($1, $2, $3)
       ON CONFLICT(text_hash) DO UPDATE SET embedding = $2, model_name = $3`,
      [textHash, embeddingJson, modelName]
    );
  } catch (error) {
    console.error("Error caching embedding:", error);
  }
}

/**
 * Get cached embedding
 */
export async function getCachedEmbedding(text, modelName) {
  const db = getDb();
  const textHash = hashText(text);

  const result = await db.query(
    `SELECT embedding FROM embeddings_cache
     WHERE text_hash = $1 AND model_name = $2`,
    [textHash, modelName]
  );

  const row = result.rows?.[0] || result[0];
  if (row && row.embedding) {
    try {
      return JSON.parse(row.embedding);
    } catch (error) {
      console.error("Error parsing cached embedding:", error);
      return null;
    }
  }
  return null;
}

/**
 * Get all embeddings for a category (for classification)
 */
export async function getCategoryEmbeddings(categoryId) {
  const db = getDb();
  const result = await db.query(
    `SELECT id, text, embedding FROM examples
     WHERE category_id = $1 AND embedding IS NOT NULL`,
    [categoryId]
  );

  const rows = result.rows || result;
  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    embedding: row.embedding ? JSON.parse(row.embedding) : null,
  }));
}

/**
 * Get all embeddings for all categories (for classification)
 */
export async function getAllEmbeddings() {
  const db = getDb();
  const result = await db.query(
    `SELECT e.category_id, c.name as category_name, e.text, e.embedding
     FROM examples e
     JOIN categories c ON e.category_id = c.id
     WHERE e.embedding IS NOT NULL`
  );

  const rows = result.rows || result;
  const embeddingsByCategory = {};

  for (const row of rows) {
    if (!embeddingsByCategory[row.category_name]) {
      embeddingsByCategory[row.category_name] = [];
    }
    try {
      embeddingsByCategory[row.category_name].push({
        example: row.text,
        vector: row.embedding ? JSON.parse(row.embedding) : null,
      });
    } catch (error) {
      console.error("Error parsing embedding:", error);
    }
  }

  return embeddingsByCategory;
}

/**
 * Update example embedding
 */
export async function updateExampleEmbedding(exampleId, embedding) {
  const db = getDb();
  const embeddingJson = JSON.stringify(embedding);
  await db.execute(
    `UPDATE examples SET embedding = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [embeddingJson, exampleId]
  );
}
