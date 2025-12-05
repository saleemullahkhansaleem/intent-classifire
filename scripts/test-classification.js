// scripts/test-classification.js
// Test classification with debugging

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

async function testClassification() {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY not set");
      process.exit(1);
    }

    console.log("🔍 Testing Classification...\n");

    const { initClassifier, classifyText } = await import(
      "../src/classifier.js"
    );

    console.log("📦 Initializing classifier...");
    await initClassifier({ openaiApiKey: OPENAI_API_KEY });

    const testPrompt = "what is 2+2";
    console.log(`\n🧪 Testing: "${testPrompt}"\n`);

    const result = await classifyText(testPrompt, OPENAI_API_KEY, {
      useGptFallback: true,
    });

    console.log("\n📊 Classification Result:");
    console.log(JSON.stringify(result, null, 2));

    console.log("\n✅ Test complete!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testClassification();
