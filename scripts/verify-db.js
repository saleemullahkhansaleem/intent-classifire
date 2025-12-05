// scripts/verify-db.js
// Verify database connection and data

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
import { readFileSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Load .env.local
const envLocalPath = resolve(projectRoot, ".env.local");
if (existsSync(envLocalPath)) {
  const envContent = readFileSync(envLocalPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        const cleanValue = value.replace(/^["']|["']$/g, "");
        process.env[key.trim()] = cleanValue;
      }
    }
  });
}

dotenv.config();

async function verifyDatabase() {
  try {
    console.log("🔍 Verifying Database Connection...\n");

    const hasPostgresUrl = !!process.env.POSTGRES_URL;
    const isVercel = process.env.VERCEL === "1";

    console.log("📋 Environment Check:");
    console.log(`   POSTGRES_URL: ${hasPostgresUrl ? "✅ Set" : "❌ Not set"}`);
    console.log(`   VERCEL: ${isVercel ? "Yes" : "No (local)"}`);
    console.log(
      `   Database: ${hasPostgresUrl ? "PostgreSQL (Neon)" : "SQLite (local)"}`
    );

    if (hasPostgresUrl) {
      console.log(
        `   Connection: ${process.env.POSTGRES_URL.substring(0, 50)}...`
      );
    }

    console.log("\n📦 Initializing database...");
    const { initDatabase, getDb } = await import("../src/db/database.js");
    await initDatabase();

    console.log("✅ Database initialized\n");

    const db = getDb();

    console.log("📊 Checking data...");
    const categories = await db.query(
      "SELECT name, (SELECT COUNT(*) FROM examples WHERE category_id = categories.id) as count FROM categories ORDER BY name"
    );

    if (categories.rows.length === 0) {
      console.log("❌ No categories found in database!");
      console.log("\n💡 Run migration:");
      console.log("   node scripts/migrate-to-neon.js");
      process.exit(1);
    }

    console.log(`\n✅ Found ${categories.rows.length} categories:\n`);
    categories.rows.forEach((cat) => {
      console.log(`   - ${cat.name.padEnd(20)} ${cat.count} examples`);
    });

    const totalExamples = categories.rows.reduce(
      (sum, cat) => sum + parseInt(cat.count),
      0
    );
    console.log(
      `\n📊 Total: ${categories.rows.length} categories, ${totalExamples} examples\n`
    );

    console.log("✅ Database verification successful!");
    console.log("\n💡 Next steps:");
    console.log("   1. Restart your dev server: npm run dev");
    console.log("   2. Open http://localhost:3000");
    console.log("   3. Click 'Manage' tab to see categories");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Verification failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyDatabase();
