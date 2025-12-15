// src/db/queries/settings.js
import { getDb } from "../database.js";

/**
 * Get a setting value by key
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getSetting(key) {
  const db = getDb();
  const result = await db.query("SELECT value FROM settings WHERE key = $1", [key]);
  const row = result.rows?.[0] || result[0];
  return row ? row.value : null;
}

/**
 * Update or insert a setting
 * @param {string} key
 * @param {string} value
 */
export async function updateSetting(key, value) {
  const db = getDb();
  await db.query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
}
