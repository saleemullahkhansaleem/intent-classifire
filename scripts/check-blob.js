/**
 * Comprehensive Blob Storage Verification Script
 * Checks actual state of Blob storage and helps debug issues
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Load .env.local explicitly
const envLocalPath = path.join(projectRoot, ".env.local");
if (fs.existsSync(envLocalPath)) {
    const dotenv = await import("dotenv");
    dotenv.config({ path: envLocalPath });
}

// Try to import and check Blob
async function checkBlob() {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║         BLOB STORAGE VERIFICATION SCRIPT                  ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    // Step 1: Check environment
    console.log("[1] Checking environment variables...");
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    const isProduction = process.env.VERCEL === "1" || !!process.env.VERCEL_ENV;

    console.log(`    BLOB_READ_WRITE_TOKEN: ${blobToken ? 'SET ✓' : 'NOT SET ❌'}`);
    console.log(`    Environment: ${isProduction ? 'Production' : 'Local Development'}`);
    console.log(`    Use Blob: ${blobToken ? 'YES' : 'NO (will use local file)'}\n`);

    // Step 2: Check local backup file
    console.log("[2] Checking local backup file...");
    const localFilePath = path.join(projectRoot, "src", "classifier_embeddings.json");
    if (fs.existsSync(localFilePath)) {
        const stats = fs.statSync(localFilePath);
        const content = JSON.parse(fs.readFileSync(localFilePath, 'utf-8'));
        const categories = Object.keys(content);
        const totalExamples = Object.values(content).reduce((sum, exs) => sum + exs.length, 0);

        console.log(`    File exists: YES ✓`);
        console.log(`    Path: ${localFilePath}`);
        console.log(`    Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`    Categories: ${categories.length}`);
        console.log(`    Total embeddings: ${totalExamples}\n`);

        if (categories.length > 0) {
            console.log("    Categories in local file:");
            categories.forEach(cat => {
                const count = content[cat].length;
                console.log(`      • ${cat}: ${count} embeddings`);
            });
        }
        console.log();
    } else {
        console.log(`    File exists: NO ❌`);
        console.log(`    Path: ${localFilePath}\n`);
    }

    // Step 3: Try to access Blob
    console.log("[3] Attempting to access Vercel Blob...");
    if (!blobToken) {
        console.log("    ⚠️  BLOB_READ_WRITE_TOKEN not set!");
        console.log("    Cannot access Blob storage without token.");
        console.log("    Add to .env.local: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...\n");
    } else {
        try {
            const { head } = await import("@vercel/blob");
            const blobPath = "intent-classifire-blob/classifier-embeddings.json";

            console.log(`    Checking for: ${blobPath}`);
            const blobFile = await head(blobPath);

            if (blobFile) {
                console.log(`    ✓ File exists in Blob!`);
                console.log(`    Size: ${(blobFile.size / 1024).toFixed(2)} KB`);
                console.log(`    Last modified: ${blobFile.uploadedAt}\n`);
            } else {
                console.log(`    ❌ File NOT found in Blob\n`);
            }
        } catch (error) {
            console.log(`    ❌ Error accessing Blob: ${error.message}`);
            console.log(`    This might mean:`);
            console.log(`      • Token is invalid`);
            console.log(`      • Blob file doesn't exist yet`);
            console.log(`      • Network issue\n`);
        }
    }

    // Step 4: Check database
    console.log("[4] Checking database...");
    try {
        const { initDatabase, getDb } = await import("../src/db/database.js");
        await initDatabase();
        const db = getDb();

        // Get category count
        const catResult = await db.query("SELECT COUNT(*) as count FROM categories");
        const catCount = catResult.rows?.[0]?.count || catResult[0]?.count || 0;

        // Get example count
        const exResult = await db.query("SELECT COUNT(*) as count FROM examples");
        const exCount = exResult.rows?.[0]?.count || exResult[0]?.count || 0;

        // Get examples with embeddings
        const embResult = await db.query(
            "SELECT COUNT(*) as count FROM examples WHERE embedding IS NOT NULL"
        );
        const embCount = embResult.rows?.[0]?.count || embResult[0]?.count || 0;

        console.log(`    Categories: ${catCount}`);
        console.log(`    Total examples: ${exCount}`);
        console.log(`    Examples with embeddings: ${embCount}`);
        console.log(`    Percentage with embeddings: ${((embCount / exCount) * 100).toFixed(1)}%\n`);

        // Get per-category breakdown
        console.log("    Per-category breakdown:");
        const categoryDetails = await db.query(`
            SELECT
                c.name,
                COUNT(e.id) as total,
                COUNT(CASE WHEN e.embedding IS NOT NULL THEN 1 END) as with_embedding
            FROM categories c
            LEFT JOIN examples e ON c.id = e.category_id
            GROUP BY c.id, c.name
            ORDER BY c.name
        `);

        const categories = categoryDetails.rows || categoryDetails;
        categories.forEach(cat => {
            const pct = cat.total > 0 ? ((cat.with_embedding / cat.total) * 100).toFixed(0) : 0;
            console.log(`      • ${cat.name}: ${cat.with_embedding}/${cat.total} (${pct}%)`);
        });
        console.log();

    } catch (error) {
        console.log(`    ❌ Error checking database: ${error.message}\n`);
    }

    // Step 5: Summary and recommendations
    console.log("[5] Summary and Recommendations\n");

    const localFileExists = fs.existsSync(localFilePath);
    const localContent = localFileExists ? JSON.parse(fs.readFileSync(localFilePath, 'utf-8')) : {};
    const localCount = Object.values(localContent).reduce((sum, exs) => sum + exs.length, 0);

    console.log("════════════════════════════════════════════════════════════");

    if (localCount === 0) {
        console.log("❌ PROBLEM: No embeddings in local backup file!");
        console.log("\nRECOMMENDED ACTION:");
        console.log("1. Run recompute: node scripts/manual-recompute.js");
        console.log("2. This will generate embeddings and save locally");
        console.log("3. Then sync to Blob: node scripts/init-blob-embeddings.js");
    } else if (!blobToken) {
        console.log(`✓ Local file has ${localCount} embeddings`);
        console.log("⚠️  PROBLEM: BLOB_READ_WRITE_TOKEN not set!");
        console.log("\nRECOMMENDED ACTION:");
        console.log("1. Get your Blob token from Vercel Dashboard");
        console.log("2. Add to .env.local: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...");
        console.log("3. Run sync script: node scripts/init-blob-embeddings.js");
    } else {
        console.log(`✓ Local file has ${localCount} embeddings`);
        console.log("✓ BLOB_READ_WRITE_TOKEN is set");
        console.log("✓ Everything should be working!");
        console.log("\nIf Blob still empty, try:");
        console.log("1. node scripts/init-blob-embeddings.js (force sync)");
    }

    console.log("════════════════════════════════════════════════════════════");
}

checkBlob().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
