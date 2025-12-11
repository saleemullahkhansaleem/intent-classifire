#!/usr/bin/env node

/**
 * Initialize Blob Storage with Embeddings from Database
 *
 * This script:
 * 1. Connects to the database
 * 2. Fetches all embeddings from the database
 * 3. Saves them to Vercel Blob storage (intent-classifire-blob/classifier-embeddings.json)
 *
 * Run once with: node scripts/init-blob-embeddings.js
 * After deployment, run on Vercel to populate Blob
 */

import "dotenv/config";

// Import after dotenv is loaded
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Load .env.local explicitly (for local development with Blob token)
const envLocalPath = path.join(projectRoot, ".env.local");
if (fs.existsSync(envLocalPath)) {
    const dotenv = await import("dotenv");
    dotenv.config({ path: envLocalPath });
}

import { initDatabase } from "../src/db/database.js";
import { getAllEmbeddings } from "../src/db/queries/embeddings.js";
import { saveEmbeddings } from "../src/blobService.js";

async function initBlobEmbeddings() {
    try {
        console.log("╔════════════════════════════════════════════════════════════╗");
        console.log("║     Initializing Blob Storage with Database Embeddings     ║");
        console.log("╚════════════════════════════════════════════════════════════╝\n");


        // Step 1: Initialize database connection
        console.log("[1] Connecting to database...");
        await initDatabase();
        console.log("✓ Database connected\n");

        // Step 1.5: Check what's in the database
        console.log("[1.5] Checking database contents...");
        const { getDb } = await import("../src/db/database.js");
        const db = getDb();

        const countResult = await db.query(`
            SELECT
                COUNT(*) as total_examples,
                COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings
            FROM examples
        `);
        const counts = countResult.rows?.[0] || countResult[0];
        console.log(`      Total examples: ${counts.total_examples}`);
        console.log(`      With embeddings: ${counts.with_embeddings}\n`);

        if (counts.with_embeddings === 0) {
            console.warn("⚠️  ERROR: No embeddings found in database!");
            console.warn(`   Database has ${counts.total_examples} examples but NONE have embeddings`);
            console.warn("   You need to run /api/recompute first to generate embeddings");
            console.warn("\n   Steps to fix:");
            console.warn("   1. Go to your Vercel deployment");
            console.warn("   2. Run: curl -X POST https://your-url/api/recompute");
            console.warn("   3. Wait 30-60 seconds for completion");
            console.warn("   4. Run this script again\n");
            process.exit(1);
        }

        // Step 2: Fetch all embeddings from database
        console.log("[2] Fetching embeddings from database...");
        const embeddings = await getAllEmbeddings();
        const totalCategories = Object.keys(embeddings).length;
        const totalExamples = Object.values(embeddings).reduce((sum, exs) => sum + exs.length, 0);

        console.log(`✓ Fetched ${totalCategories} categories with ${totalExamples} total examples\n`);

        if (totalCategories === 0) {
            console.warn("⚠️  WARNING: No embeddings found in database!");
            console.warn("   Make sure you have run /api/recompute first.");
            process.exit(1);
        }

        // Step 3: Save to Blob
        console.log("[3] Saving embeddings to Blob...");

        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            console.error("❌ ERROR: BLOB_READ_WRITE_TOKEN not set in environment variables");
            console.error("   Please add BLOB_READ_WRITE_TOKEN to your .env.local or Vercel environment");
            process.exit(1);
        }

        const saved = await saveEmbeddings(embeddings);

        if (!saved) {
            console.error("❌ Failed to save embeddings to Blob");
            process.exit(1);
        }

        console.log("✓ Embeddings saved to Blob\n");

        // Step 4: Verify
        console.log("[4] Verifying Blob storage...");
        console.log("   Location: intent-classifire-blob/classifier-embeddings.json");
        console.log(`   Categories: ${totalCategories}`);
        console.log(`   Examples: ${totalExamples}`);
        console.log("\n");

        console.log("╔════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ SUCCESS: Blob storage initialized!                    ║");
        console.log("║                                                            ║");
        console.log("║  Vector file will now be updated on each recompute        ║");
        console.log("║  Check Vercel Dashboard → Storage → Blob                  ║");
        console.log("╚════════════════════════════════════════════════════════════╝");

    } catch (error) {
        console.error("❌ ERROR:", error.message);
        console.error("\nStack:", error.stack);
        console.error("\nTroubleshooting:");
        console.error("  1. Make sure DATABASE_URL is set correctly");
        console.error("  2. Make sure BLOB_READ_WRITE_TOKEN is set");
        console.error("  3. Make sure you've run /api/recompute first to generate embeddings");
        process.exit(1);
    }
}

// Run the script
initBlobEmbeddings();
