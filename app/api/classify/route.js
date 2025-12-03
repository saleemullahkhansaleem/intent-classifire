import { NextResponse } from "next/server";
import "dotenv/config";
import { classifyText, initClassifier } from "@/src/classifier.js";
import OpenAI from "openai";

// Initialize classifier on first import
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OpenAI;
let classifierInitialized = false;

if (!classifierInitialized) {
  initClassifier({ openaiApiKey: OPENAI_API_KEY });
  classifierInitialized = true;
}

// Embedding function
const getEmbedding = async (text) => {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const response = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });

  console.log("embedding response", response);

  return {
    embedding: response.data[0].embedding,
    usage: response.usage || { total_tokens: 0 },
  };
};

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

    // Wrapper to pass embedding with usage info
    const getEmbeddingWrapper = async (text) => {
      const result = await getEmbedding(text);
      return {
        embedding: result.embedding,
        usage: result.usage,
      };
    };

    // Classify all prompts (always return an array of results)
    const results = [];
    for (const p of inputPrompts) {
      const classification = await classifyText(getEmbeddingWrapper, p, {
        useGptFallback: true,
      });

      const source = classification.score === 0.5 ? "gpt_fallback" : "local";
      results.push({ ...classification, source });
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
