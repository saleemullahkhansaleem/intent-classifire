/**
 * Manual recompute script - bypasses API and runs recompute directly
 * This will populate database with embeddings from scratch
 */

import { recomputeEmbeddings } from "../src/embeddingService.js";

async function manualRecompute() {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║           Manual Embedding Recomputation Script            ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("🚀 Starting recomputation...\n");

    try {
        const result = await recomputeEmbeddings();

        console.log("\n╔════════════════════════════════════════════════════════════╗");
        console.log("║                    RECOMPUTATION RESULT                   ║");
        console.log("╚════════════════════════════════════════════════════════════╝\n");

        console.log("Status:", result.success ? "✓ SUCCESS" : "❌ FAILED");
        console.log("Message:", result.message);
        console.log("Categories processed:", result.labelsProcessed);
        console.log("Examples computed:", result.totalExamples);
        console.log("Examples skipped:", result.skippedExamples);
        console.log("Already computed:", result.alreadyComputed);
        console.log("Time elapsed:", result.elapsedSeconds, "seconds");
        console.log("Data persisted:", result.persisted ? "✓ YES" : "❌ NO");
        console.log("Incomplete:", result.incomplete ? "YES (more work needed)" : "NO (all done)");

        if (result.consumption) {
            console.log("\nConsumption:");
            console.log("  Tokens:", result.consumption.tokens.total);
            console.log("  Cost: $" + result.consumption.cost.total.toFixed(4));
        }

        if (result.categoryStats) {
            console.log("\nPer-category breakdown:");
            for (const [name, stats] of Object.entries(result.categoryStats)) {
                console.log(`  ${name}:`);
                console.log(`    Total: ${stats.total}, Computed: ${stats.computed}, Already: ${stats.alreadyComputed}, Failed: ${stats.failed}`);
            }
        }

        // Now verify that data was saved
        console.log("\n" + "═".repeat(60));
        console.log("Verifying data in database...\n");

        const { initDatabase, getDb } = await import("../src/db/database.js");
        await initDatabase();
        const db = getDb();

        const countResult = await db.query(`
            SELECT
                COUNT(*) as total_examples,
                COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings
            FROM examples
        `);
        const counts = countResult.rows?.[0] || countResult[0];

        console.log(`Total examples in database: ${counts.total_examples}`);
        console.log(`Examples with embeddings: ${counts.with_embeddings}`);

        if (counts.with_embeddings > 0) {
            console.log("\n✅ SUCCESS! Embeddings have been saved to database");
        } else {
            console.log("\n❌ PROBLEM: No embeddings found in database");
            console.log("   This means updateExampleEmbedding() calls are not persisting");
        }

    } catch (error) {
        console.error("\n❌ ERROR during recomputation:");
        console.error("Message:", error.message);
        console.error("\nStack trace:");
        console.error(error.stack);
        process.exit(1);
    }
}

manualRecompute().catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
});
