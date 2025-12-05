// src/db/migrate.js
// Database migration script

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

// Load environment variables from .env.local first, then .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../..");

// Load .env.local first (Next.js convention), then .env as fallback
dotenv.config({ path: resolve(projectRoot, ".env.local") });
dotenv.config({ path: resolve(projectRoot, ".env") });

import { initDatabase } from "./database.js";
import { migrateFromJson } from "./migrations/migrateFromJson.js";

async function runMigrations() {
  try {
    console.log("Initializing database schema...");
    await initDatabase();
    console.log("Database schema initialized.");

    // Check if migration from JSON is needed
    const shouldMigrate = process.argv.includes("--migrate-json");
    const force = process.argv.includes("--force");
    if (shouldMigrate) {
      console.log("Migrating data from labels.json...");
      await migrateFromJson({ force });
      console.log("Migration from JSON completed.");
    }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
