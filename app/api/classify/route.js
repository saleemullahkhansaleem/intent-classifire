import { NextResponse } from "next/server";
import "dotenv/config";
import { classifyText, initClassifier } from "@/src/classifier.js";

// Initialize classifier on first import
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OpenAI;
let classifierInitialized = false;

async function ensureClassifierInitialized() {
  if (!classifierInitialized) {
    await initClassifier({ openaiApiKey: OPENAI_API_KEY });
    classifierInitialized = true;
  }
}

export async function POST(request) {
  try {
    await ensureClassifierInitialized();
    const body = await request.json();
    const { prompt, prompts } = body;

    let inputPrompts = [];

    if (prompt && typeof prompt === "string") {
      inputPrompts = [prompt];
    } else if (Array.isArray(prompts) && prompts.length > 0) {
      inputPrompts = prompts.filter(
        (p) => typeof p === "string" && p.trim() !== ""
      );
      if (inputPrompts.length === 0) {
        return NextResponse.json(
          { error: "No valid string prompts in array" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid input: provide 'prompt' or 'prompts' array" },
        { status: 400 }
      );
    }

    // Classify all prompts (always return an array of results)
    const results = [];
    for (const p of inputPrompts) {
      const classification = await classifyText(p, OPENAI_API_KEY, {
        useGptFallback: true,
      });
      // Source is already set by classifyText ("Local" or "fallback")
      results.push(classification);
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Classification error:", error);
    return NextResponse.json(
      { error: "Classification failed", details: error.message },
      { status: 500 }
    );
  }
}
