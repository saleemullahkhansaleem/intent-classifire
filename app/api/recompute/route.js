import { NextResponse } from "next/server";
import { recomputeEmbeddings } from "@/src/lib/embeddings/recomputer.js";

// Increase timeout for this route (Vercel has 10s limit on Hobby, 60s on Pro)
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { batch = false, maxExamples = null } = body;

    console.log("Starting embedding recomputation request...", { batch, maxExamples });

    // Call the recomputer which handles DB, Concurrency, and Cache Sync
    const stats = await recomputeEmbeddings({ maxExamples });

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
                    embeddings: 0, // Local embeddings are free
                    gpt: 0,
                    total: 0,
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
