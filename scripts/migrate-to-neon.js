// scripts/migrate-to-neon.js
// Migrate data to Neon PostgreSQL database

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
import { readFileSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Load .env.local file
const envLocalPath = resolve(projectRoot, ".env.local");
if (existsSync(envLocalPath)) {
  const envContent = readFileSync(envLocalPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, "");
        process.env[key.trim()] = cleanValue;
      }
    }
  });
}

// Also load regular .env
dotenv.config({ path: resolve(projectRoot, ".env") });

// Now import and run migration
const { initDatabase } = await import("../src/db/database.js");
const { migrateFromJson } = await import(
  "../src/db/migrations/migrateFromJson.js"
);

async function migrateToNeon() {
  try {
    if (!process.env.POSTGRES_URL) {
      console.error("❌ POSTGRES_URL not found in .env.local");
      console.log("\nPlease ensure .env.local contains:");
      console.log("POSTGRES_URL=postgresql://...");
      process.exit(1);
    }

    console.log("🔗 Connecting to Neon PostgreSQL...");
    console.log("   Using:", process.env.POSTGRES_URL.substring(0, 50) + "...");

    console.log("\n📦 Initializing database schema...");
    await initDatabase();
    console.log("✅ Database schema initialized.");

    console.log("\n📥 Migrating data from labels.json...");
    await migrateFromJson({ force: true });

    console.log("\n✅ Migration to Neon completed successfully!");

    // Verify data
    const { getDb } = await import("../src/db/database.js");
    const db = getDb();
    const categories = await db.query(
      "SELECT COUNT(*) as count FROM categories"
    );
    const examples = await db.query("SELECT COUNT(*) as count FROM examples");

    console.log("\n📊 Verification:");
    console.log(`   Categories: ${categories.rows[0].count}`);
    console.log(`   Examples: ${examples.rows[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migrateToNeon();
