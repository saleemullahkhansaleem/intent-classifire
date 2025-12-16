// src/db/queries/embeddings.js
// Embedding storage and retrieval queries

import { getDb } from "../database.js";

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
