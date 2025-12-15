import { NextResponse } from "next/server";
import "dotenv/config";
import { classifyText, initClassifier } from "@/src/classifier.js";

// Initialize classifier on first import
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OpenAI;

// We can rely on ClassifierCache.init() being idempotent and fast if already initialized
// But it's good practice to call it once globally if possible, or lazily.
// Next.js hot reloading can mess with global state, but our Cache singleton handles it.
initClassifier().catch(err => console.error("Failed to init classifier:", err));

export async function POST(request) {
  try {
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
    // Process in parallel for speed if multiple prompts
    await Promise.all(inputPrompts.map(async (p) => {
        try {
            const classification = await classifyText(p, OPENAI_API_KEY, {
                useGptFallback: true,
            });
            results.push(classification);
        } catch (e) {
            console.error(`Failed to classify '${p}':`, e);
            results.push({ error: "Classification failed", prompt: p });
        }
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Classification error:", error);
    return NextResponse.json(
      { error: "Classification failed", details: error.message },
      { status: 500 }
    );
  }
}
