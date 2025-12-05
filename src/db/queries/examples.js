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
