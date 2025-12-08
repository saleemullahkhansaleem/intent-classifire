import { NextResponse } from "next/server";
import { recomputeEmbeddings } from "@/src/embeddingService.js";

// Increase timeout for this route (Vercel has 10s limit on Hobby, 60s on Pro)
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { batch = false } = body; // Allow batch processing mode

    console.log("Starting embedding recomputation request...", { batch });
    const result = await recomputeEmbeddings();
    console.log("Recomputation completed:", result);

    // Handle incomplete processing (timeout or limit reached)
    if (result.incomplete) {
      return NextResponse.json(
        {
          ...result,
          warning: result.message,
          note:
            "This is a batch operation. Run the recomputation again to process remaining examples. " +
            "Embeddings will also be computed on-demand during classification.",
        },
        { status: 200 }
      );
    }

    // If embeddings weren't persisted (read-only environment), return a warning
    if (result.persisted === false) {
      return NextResponse.json(
        {
          ...result,
          warning:
            "Embeddings were computed but not persisted due to read-only filesystem. " +
            "They will be computed on-demand during classification.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error recomputing embeddings:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      {
        error: "Failed to recompute embeddings",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
