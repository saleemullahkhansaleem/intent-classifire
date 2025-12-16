// src/db/utils.js
// Shared database utilities

import { initDatabase } from "./database.js";

let dbInitialized = false;

/**
 * Ensure database is initialized (singleton pattern)
 */
export async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

