import { initDatabase, getDb } from "../src/db/database.js";
import { updateExampleEmbedding, getAllEmbeddings } from "../src/db/queries/embeddings.js";

async function testUpdate() {
    console.log("Testing embedding update functionality...\n");

    // Initialize database
    await initDatabase();
    const db = getDb();

    // Get a sample example
    console.log("[1] Fetching a sample example...");
    const result = await db.query(`SELECT id, text, embedding FROM examples LIMIT 1`);

    if (!result.rows || result.rows.length === 0) {
        console.error("❌ No examples found in database");
        process.exit(1);
    }

    const example = result.rows[0];
    console.log(`    Found example ID: ${example.id}`);
    console.log(`    Text: ${example.text.substring(0, 50)}...`);
    console.log(`    Current embedding: ${example.embedding ? 'EXISTS' : 'NULL'}\n`);

    // Create a test embedding
    console.log("[2] Creating test embedding...");
    const testEmbedding = new Array(1536).fill(0).map((_, i) => Math.random() * 0.01);
    console.log(`    Created vector of ${testEmbedding.length} dimensions\n`);

    // Update the example
    console.log(`[3] Updating example ${example.id} with test embedding...`);
    try {
        await updateExampleEmbedding(example.id, testEmbedding);
        console.log("    ✓ Update executed without error\n");
    } catch (error) {
        console.error(`    ❌ Update failed: ${error.message}\n`);
        process.exit(1);
    }

    // Verify the update
    console.log(`[4] Verifying update...`);
    const verifyResult = await db.query(
        `SELECT id, text, embedding FROM examples WHERE id = $1`,
        [example.id]
    );

    if (!verifyResult.rows || verifyResult.rows.length === 0) {
        console.error("    ❌ Example not found after update!");
        process.exit(1);
    }

    const updated = verifyResult.rows[0];
    const hasEmbedding = updated.embedding !== null && updated.embedding !== undefined;

    console.log(`    Embedding after update: ${hasEmbedding ? 'EXISTS ✓' : 'STILL NULL ❌'}`);

    if (hasEmbedding) {
        // Parse if it's a string
        const embeddingData = typeof updated.embedding === 'string'
            ? JSON.parse(updated.embedding)
            : updated.embedding;
        console.log(`    Embedding is array: ${Array.isArray(embeddingData) ? 'YES ✓' : 'NO ❌'}`);
        if (Array.isArray(embeddingData)) {
            console.log(`    Embedding length: ${embeddingData.length}`);
        }
    }
    console.log();

    // Test getAllEmbeddings
    console.log("[5] Testing getAllEmbeddings()...");
    try {
        const embeddings = await getAllEmbeddings();
        const categories = Object.keys(embeddings);
        const totalExamples = Object.values(embeddings).reduce((sum, exs) => sum + exs.length, 0);
        console.log(`    Found ${categories.length} categories`);
        console.log(`    Total examples with embeddings: ${totalExamples}`);

        if (totalExamples > 0) {
            console.log("    ✓ getAllEmbeddings() is working correctly");
        } else {
            console.log("    ❌ getAllEmbeddings() returned no results (update not visible?)");
        }
    } catch (error) {
        console.error(`    ❌ getAllEmbeddings() failed: ${error.message}`);
        process.exit(1);
    }

    console.log("\n✅ Test complete!");
}

testUpdate().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
