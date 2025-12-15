// src/db/queries/examples.js
// Example CRUD queries

import { getDb } from "../database.js";

/**
 * Get all examples for a category
 */
export async function getExamplesByCategoryId(categoryId) {
  const db = getDb();
  const result = await db.query(
    "SELECT * FROM examples WHERE category_id = $1 ORDER BY created_at",
    [categoryId]
  );
  return result.rows || result;
}

/**
 * Get examples for a category without embedding data (lightweight, fast)
 * Only returns id, text, and embedding status for UI display
 */
export async function getExamplesByCategoryIdLightweight(categoryId) {
  const db = getDb();
  const result = await db.query(
    `SELECT 
      id, 
      text, 
      (embedding IS NOT NULL) as hasEmbedding,
      created_at,
      updated_at
    FROM examples 
    WHERE category_id = $1 
    ORDER BY created_at`,
    [categoryId]
  );
  const rows = result.rows || result;
  // Map hasEmbedding to embedding field for UI compatibility
  // Handle both lowercase and uppercase column names from different databases
  return rows.map(row => {
    const hasEmbedding = row.hasembedding !== undefined ? row.hasembedding : row.hasEmbedding;
    return {
      id: row.id,
      text: row.text,
      embedding: hasEmbedding ? true : null, // Use boolean/null for UI (truthy check works)
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  });
}

/**
 * Get only uncomputed examples (where embedding IS NULL) for a category
 */
export async function getUncomputedExamplesByCategoryId(categoryId) {
  const db = getDb();
  const result = await db.query(
    "SELECT * FROM examples WHERE category_id = $1 AND embedding IS NULL ORDER BY created_at",
    [categoryId]
  );
  return result.rows || result;
}

/**
 * Get example by ID
 */
export async function getExampleById(id) {
  const db = getDb();
  const result = await db.query("SELECT * FROM examples WHERE id = $1", [id]);
  const rows = result.rows || result;
  return rows[0] || null;
}

/**
 * Create example
 */
export async function createExample(categoryId, text, embedding = null) {
  const db = getDb();
  const embeddingJson = embedding ? JSON.stringify(embedding) : null;
  const result = await db.query(
    `INSERT INTO examples (category_id, text, embedding)
     VALUES ($1, $2, $3) RETURNING *`,
    [categoryId, text, embeddingJson]
  );
  const rows = result.rows || result;
  return rows[0];
}

/**
 * Bulk create examples
 */
export async function bulkCreateExamples(
  categoryId,
  examples,
  embeddings = []
) {
  const db = getDb();
  const results = [];

  for (let i = 0; i < examples.length; i++) {
    const text = examples[i];
    const embedding = embeddings[i] || null;
    const embeddingJson = embedding ? JSON.stringify(embedding) : null;

    try {
      const result = await db.query(
        `INSERT INTO examples (category_id, text, embedding)
         VALUES ($1, $2, $3) RETURNING *`,
        [categoryId, text, embeddingJson]
      );
      results.push({ success: true, example: result.rows?.[0] || result[0] });
    } catch (error) {
      results.push({ success: false, error: error.message, text });
    }
  }

  return results;
}

/**
 * Update example
 */
export async function updateExample(id, text, embedding = null) {
  const db = getDb();
  const embeddingJson = embedding ? JSON.stringify(embedding) : null;
  const result = await db.query(
    `UPDATE examples SET text = $1, embedding = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 RETURNING *`,
    [text, embeddingJson, id]
  );
  const rows = result.rows || result;
  return rows[0];
}

/**
 * Delete example
 */
export async function deleteExample(id) {
  const db = getDb();
  await db.execute("DELETE FROM examples WHERE id = $1", [id]);
}

/**
 * Bulk delete examples
 */
export async function bulkDeleteExamples(ids) {
  const db = getDb();
  if (!ids || ids.length === 0) return { deleted: 0 };

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
  const result = await db.execute(
    `DELETE FROM examples WHERE id IN (${placeholders})`,
    ids
  );

  return { deleted: ids.length };
}
