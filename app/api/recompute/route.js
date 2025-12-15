import { NextResponse } from "next/server";
import { recomputeEmbeddings } from "@/src/lib/embeddings/recomputer.js";

const USE_LOCAL_EMBEDDINGS = process.env.USE_LOCAL_EMBEDDINGS !== "false"; // Default: true

// Increase timeout for this route (Vercel has 10s limit on Hobby, 60s on Pro)
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { batch = false, maxExamples = null } = body;

    console.log("Starting embedding recomputation request...", { batch, maxExamples });

    // Call the recomputer which handles DB, Concurrency, and Cache Sync
    const stats = await recomputeEmbeddings({ maxExamples });

    // Calculate embedding cost based on whether using local or OpenAI
    // OpenAI text-embedding-3-large: $0.00013 per 1K tokens
    const embeddingCost = USE_LOCAL_EMBEDDINGS 
      ? 0 
      : ((stats.totalTokens || 0) / 1000) * 0.00013;

    return NextResponse.json({
        success: true,
        message: "Recomputation completed.",
        stats: {
            ...stats,
            consumption: {
                tokens: {
                    input: stats.totalTokens || 0,
                    output: 0,
                    total: stats.totalTokens || 0,
                },
                cost: {
                    embeddings: embeddingCost,
                    gpt: 0,
                    total: embeddingCost,
                },
            }
        }
    });
  } catch (error) {
    console.error("Error recomputing embeddings:", error);
    return NextResponse.json(
      {
        error: "Failed to recompute embeddings",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
