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
