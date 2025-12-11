/**
 * Full Recompute Script - Generates embeddings for ALL examples in database
 * This is for local use and handles all 1626+ examples
 * Runs without the 100-example-per-request limit
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

async function fullRecompute() {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║         FULL RECOMPUTE - ALL EXAMPLES                     ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    try {
        const { initDatabase, getDb } = await import("../src/db/database.js");
        const { getAllCategories } = await import("../src/db/queries/categories.js");
        const { getUncomputedExamplesByCategoryId, getExamplesByCategoryId } = await import("../src/db/queries/examples.js");
        const { updateExampleEmbedding, getAllEmbeddings } = await import("../src/db/queries/embeddings.js");
        const { saveEmbeddings } = await import("../src/blobService.js");

        // Step 1: Initialize database
        console.log("[1] Initializing database...");
        await initDatabase();
        console.log("✓ Database connected\n");

        // Step 2: Get all categories
        console.log("[2] Fetching categories...");
        const categories = await getAllCategories();
        console.log(`✓ Found ${categories.length} categories\n`);

        // Check if all examples already have embeddings
        const db = getDb();
        const allResult = await db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_emb FROM examples");
        const counts = allResult.rows?.[0] || allResult[0];
        console.log(`[3] Current database state:`);
        console.log(`    Total examples: ${counts.total}`);
        console.log(`    With embeddings: ${counts.with_emb}`);
        console.log(`    Missing embeddings: ${counts.total - counts.with_emb}\n`);

        if (counts.with_emb === counts.total) {
            console.log("✓ All examples already have embeddings!");
            console.log("\nNow syncing to Blob storage...\n");
        } else {
            console.log(`[4] Generating ${counts.total - counts.with_emb} missing embeddings...\n`);

            const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
            if (!OPENAI_API_KEY) {
                throw new Error("OPENAI_API_KEY not set");
            }

            const { default: OpenAI } = await import("openai");
            const client = new OpenAI({ apiKey: OPENAI_API_KEY });

            let totalProcessed = 0;
            let totalTokens = 0;
            const startTime = Date.now();
            const embeddingModel = process.env.EMBEDDING_MODEL || "text-embedding-3-large";

            for (const category of categories) {
                console.log(`Processing ${category.name}...`);

                // Get all uncomputed examples
                const uncomputed = await getUncomputedExamplesByCategoryId(category.id);
                if (uncomputed.length === 0) {
                    console.log(`  ✓ All examples already have embeddings (${(await getExamplesByCategoryId(category.id)).length} total)\n`);
                    continue;
                }

                console.log(`  Generating ${uncomputed.length} embeddings...`);
                let categoryProcessed = 0;

                for (const example of uncomputed) {
                    try {
                        const response = await client.embeddings.create({
                            model: embeddingModel,
                            input: example.text,
                        });

                        const embedding = response.data[0].embedding;
                        const tokens = response.usage.total_tokens || 0;

                        await updateExampleEmbedding(example.id, embedding);

                        totalProcessed++;
                        totalTokens += tokens;
                        categoryProcessed++;

                        // Progress every 50
                        if (categoryProcessed % 50 === 0) {
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`    ${categoryProcessed}/${uncomputed.length} (${totalProcessed} total, ${elapsed}s)`);
                        }
                    } catch (err) {
                        console.error(`    ❌ Error on example ${example.id}: ${err.message}`);
                    }
                }

                console.log(`  ✓ Completed ${categoryProcessed}/${uncomputed.length}\n`);
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[5] Embedding Generation Complete`);
            console.log(`    Total processed: ${totalProcessed}`);
            console.log(`    Total tokens: ${totalTokens}`);
            console.log(`    Time elapsed: ${elapsed}s`);
            console.log(`    Cost: $${((totalTokens / 1000) * 0.00013).toFixed(4)}\n`);
        }

        // Step: Verify all examples have embeddings
        console.log(`[6] Verifying all examples have embeddings...`);
        const verifyResult = await db.query("SELECT COUNT(*) as total, COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_emb FROM examples");
        const verifyCounts = verifyResult.rows?.[0] || verifyResult[0];
        console.log(`    Total: ${verifyCounts.total}`);
        console.log(`    With embeddings: ${verifyCounts.with_emb}`);

        if (verifyCounts.with_emb === verifyCounts.total) {
            console.log(`    ✓ ALL EXAMPLES HAVE EMBEDDINGS!\n`);
        } else {
            console.log(`    ⚠️  Some examples still missing embeddings!\n`);
        }

        // Step: Save to Blob and local file
        console.log(`[7] Fetching all embeddings from database...`);
        const allEmbeddings = await getAllEmbeddings();
        const totalCategories = Object.keys(allEmbeddings).length;
        const totalExamples = Object.values(allEmbeddings).reduce((sum, exs) => sum + exs.length, 0);

        console.log(`✓ Fetched ${totalCategories} categories with ${totalExamples} total embeddings\n`);

        console.log(`[8] Saving embeddings to storage...`);
        await saveEmbeddings(allEmbeddings);
        console.log(`✓ Embeddings saved\n`);

        // Step: Display summary
        console.log(`╔════════════════════════════════════════════════════════════╗`);
        console.log(`║                    SUCCESS! ✅                             ║`);
        console.log(`╚════════════════════════════════════════════════════════════╝\n`);

        console.log(`Categories generated:  ${totalCategories}`);
        console.log(`Total embeddings:      ${totalExamples}`);
        console.log(`Stored in:             Database + Local backup`);
        console.log(`Ready for Blob sync:   YES ✓\n`);

        console.log(`Next steps:`);
        console.log(`1. Sync to Vercel Blob: node scripts/init-blob-embeddings.js`);
        console.log(`2. Test classification: npm run dev`);

    } catch (error) {
        console.error("\n❌ Error during recompute:");
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fullRecompute();
