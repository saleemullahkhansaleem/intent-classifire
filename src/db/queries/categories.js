// src/db/queries/categories.js
// Category CRUD queries

import { getDb } from "../database.js";

/**
 * Get all categories
 */
export async function getAllCategories() {
  const db = getDb();
  const result = await db.query("SELECT * FROM categories ORDER BY name");
  return result.rows || result;
}

/**
 * Get category by ID
 */
export async function getCategoryById(id) {
  const db = getDb();
  const result = await db.query("SELECT * FROM categories WHERE id = $1", [id]);
  const rows = result.rows || result;
  return rows[0] || null;
}

/**
 * Get category by name
 */
export async function getCategoryByName(name) {
  const db = getDb();
  const result = await db.query("SELECT * FROM categories WHERE name = $1", [
    name,
  ]);
  const rows = result.rows || result;
  return rows[0] || null;
}

/**
 * Create a new category
 */
export async function createCategory(
  name,
  description = null,
  threshold = 0.4
) {
  const db = getDb();
  const result = await db.query(
    `INSERT INTO categories (name, description, threshold)
     VALUES ($1, $2, $3) RETURNING *`,
    [name, description, threshold]
  );
  const rows = result.rows || result;
  return rows[0];
}

/**
 * Update category
 */
export async function updateCategory(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.threshold !== undefined) {
    fields.push(`threshold = $${paramIndex++}`);
    values.push(updates.threshold);
  }

  if (fields.length === 0) {
    return getCategoryById(id);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await db.query(
    `UPDATE categories SET ${fields.join(
      ", "
    )} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  const rows = result.rows || result;
  return rows[0];
}

/**
 * Delete category
 */
export async function deleteCategory(id) {
  const db = getDb();
  await db.execute("DELETE FROM categories WHERE id = $1", [id]);
}

/**
 * Update category threshold
 */
export async function updateCategoryThreshold(id, threshold) {
  return updateCategory(id, { threshold });
}

/**
 * Update threshold for all categories
 */
export async function updateAllCategoriesThreshold(threshold) {
  const db = getDb();
  const result = await db.query(
    `UPDATE categories SET threshold = $1, updated_at = CURRENT_TIMESTAMP RETURNING *`,
    [threshold]
  );
  return result.rows || result;
}

/**
 * Get category with embedding status (counts of computed/uncomputed examples)
 */
export async function getCategoryWithEmbeddingStatus(categoryId) {
  const db = getDb();

  // Get category info
  const categoryResult = await db.query(
    "SELECT * FROM categories WHERE id = $1",
    [categoryId]
  );
  const category = categoryResult.rows?.[0] || categoryResult[0];

  if (!category) return null;

  // Get example counts
  const countsResult = await db.query(
    `SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as computed,
      COUNT(CASE WHEN embedding IS NULL THEN 1 END) as uncomputed
     FROM examples WHERE category_id = $1`,
    [categoryId]
  );
  const counts = countsResult.rows?.[0] || countsResult[0];

  // Handle both lowercase and uppercase column names
  const total = parseInt(counts.total || counts.TOTAL || 0) || 0;
  const computed = parseInt(counts.computed || counts.COMPUTED || 0) || 0;
  const uncomputed = parseInt(counts.uncomputed || counts.UNCOMPUTED || 0) || 0;
  const completionPercentage = total === 0 ? 0 : Math.round((computed / total) * 100);

  return {
    ...category,
    examplesCount: total,
    computedCount: computed,
    uncomputedCount: uncomputed,
    completionPercentage
  };
}

/**
 * Get all categories with embedding status
 */
export async function getAllCategoriesWithStatus() {
  const db = getDb();

  const result = await db.query(
    `SELECT
      c.id,
      c.name,
      c.description,
      c.threshold,
      c.created_at,
      c.updated_at,
      COUNT(e.id) as examplesCount,
      COUNT(CASE WHEN e.embedding IS NOT NULL THEN 1 END) as computedCount,
      COUNT(CASE WHEN e.embedding IS NULL THEN 1 END) as uncomputedCount
     FROM categories c
     LEFT JOIN examples e ON c.id = e.category_id
     GROUP BY c.id, c.name, c.description, c.threshold, c.created_at, c.updated_at
     ORDER BY c.name`
  );

  const rows = result.rows || result;
  return rows.map(row => {
    // Handle both lowercase and uppercase column names from different databases
    const examplesCount = parseInt(row.examplesCount || row.examplescount || 0) || 0;
    const computedCount = parseInt(row.computedCount || row.computedcount || 0) || 0;
    const completionPercentage = examplesCount === 0 ? 0 : Math.round((computedCount / examplesCount) * 100);

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      threshold: row.threshold,
      created_at: row.created_at,
      updated_at: row.updated_at,
      examplesCount,
      computedCount,
      uncomputedCount: parseInt(row.uncomputedCount || row.uncomputedcount || 0) || 0,
      completionPercentage
    };
  });
}

