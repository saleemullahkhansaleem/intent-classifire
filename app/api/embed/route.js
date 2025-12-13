// app/api/embed/route.js
// Helper API to call local embedding service
import { NextResponse } from "next/server";

const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL || "http://localhost:3001";

/**
 * POST /api/embed - Generate embedding for text using local service
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { text, texts } = body;

    // Validate input
    if (!text && (!texts || !Array.isArray(texts))) {
      return NextResponse.json(
        { error: "Either 'text' or 'texts' array is required" },
        { status: 400 }
      );
    }

    // Choose endpoint based on input
    const endpoint = texts ? "/embed/batch" : "/embed";
    const payload = texts ? { texts } : { text };

    // Call local embedding service
    const response = await fetch(`${EMBEDDING_SERVICE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: "Embedding service error", details: error },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Embed API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate embedding",
        details: error.message,
        hint: "Make sure EMBEDDING_SERVICE_URL is set correctly",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/embed - Health check
 */
export async function GET() {
  try {
    const response = await fetch(`${EMBEDDING_SERVICE_URL}/health`);
    const data = await response.json();

    return NextResponse.json({
      status: "ok",
      embeddingService: data,
      serviceUrl: EMBEDDING_SERVICE_URL,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error.message,
        serviceUrl: EMBEDDING_SERVICE_URL,
        hint: "Embedding service may not be running",
      },
      { status: 503 }
    );
  }
}
