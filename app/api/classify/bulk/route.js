import { NextResponse } from "next/server";
import "dotenv/config";
import { classifyText, initClassifier } from "@/src/classifier.js";
import { initDatabase } from "@/src/db/database.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.Openai;
let classifierInitialized = false;
let dbInitialized = false;

async function ensureInitialized() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
  if (!classifierInitialized) {
    await initClassifier({ openaiApiKey: OPENAI_API_KEY });
    classifierInitialized = true;
  }
}

export async function POST(request) {
  try {
    await ensureInitialized();
    const body = await request.json();
    const { prompts } = body;

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json(
        { error: "Prompts must be a non-empty array" },
        { status: 400 }
      );
    }

    // Filter valid prompts
    const validPrompts = prompts.filter(
      (p) => typeof p === "string" && p.trim() !== ""
    );

    if (validPrompts.length === 0) {
      return NextResponse.json(
        { error: "No valid prompts provided" },
        { status: 400 }
      );
    }

    // Classify all prompts
    const results = [];
    const consumption = {
      tokens: { input: 0, output: 0, total: 0 },
      cost: { embeddings: 0, gpt: 0, total: 0 },
    };

    for (const prompt of validPrompts) {
      const classification = await classifyText(prompt, OPENAI_API_KEY, {
        useGptFallback: true,
      });
      results.push(classification);

      // Aggregate consumption (only for fallback cases)
      if (classification.consumption) {
        consumption.tokens.input +=
          classification.consumption.tokens?.input || 0;
        consumption.tokens.output +=
          classification.consumption.tokens?.output || 0;
        consumption.tokens.total +=
          classification.consumption.tokens?.total || 0;
        consumption.cost.embeddings +=
          classification.consumption.cost?.embeddings || 0;
        consumption.cost.gpt += classification.consumption.cost?.gpt || 0;
        consumption.cost.total += classification.consumption.cost?.total || 0;
      }
    }

    return NextResponse.json({
      results,
      consumption,
      totalPrompts: validPrompts.length,
      processedPrompts: results.length,
    });
  } catch (error) {
    console.error("Bulk classification error:", error);
    return NextResponse.json(
      { error: "Bulk classification failed", details: error.message },
      { status: 500 }
    );
  }
}
