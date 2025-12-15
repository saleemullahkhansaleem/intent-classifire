/**
 * Verification Script
 * Run with: node verify_api.js
 */

const BASE_URL = "http://localhost:3000";

async function testClassify() {
  console.log("Testing /api/classify...");
  try {
    const res = await fetch(`${BASE_URL}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello world" }),
    });

    if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);

    const data = await res.json();
    console.log("Classify Response:", JSON.stringify(data, null, 2));

    // Validation
    const result = data.results[0];
    if (result.source !== "Local" && result.source !== "fallback") console.error("❌ Invalid source");

    // Check Cost Rules
    if (result.consumption && result.consumption.cost.embeddings !== 0) {
        console.error("❌ Embedding cost MUST be 0");
    } else {
        console.log("✅ Embedding cost is 0");
    }

  } catch (err) {
    console.error("❌ Classify Test Failed:", err.message);
  }
}

async function testRecompute() {
  console.log("\nTesting /api/recompute...");
  try {
    const res = await fetch(`${BASE_URL}/api/recompute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch: true, maxExamples: 5 }),
    });

    if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);

    const data = await res.json();
    console.log("Recompute Response:", JSON.stringify(data, null, 2));

    if (data.success) {
        console.log("✅ Recompute success");
    } else {
        console.error("❌ Recompute reported failure");
    }

  } catch (err) {
    console.error("❌ Recompute Test Failed:", err.message);
  }
}

async function run() {
  await testClassify();
  await testRecompute();
}

run();
