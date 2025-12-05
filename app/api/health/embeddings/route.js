import { NextResponse } from "next/server";
import { initClassifier } from "@/src/classifier.js";

/**
 * Diagnostic endpoint to check embeddings status
 * Useful for debugging Vercel deployment issues
 */
export async function GET() {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.Openai;

    // Try to initialize classifier
    await initClassifier({ openaiApiKey: OPENAI_API_KEY });

    // Import after initialization to get current state
    const { getAllEmbeddings } = await import("@/src/db/queries/embeddings.js");
    const { getAllCategories } = await import("@/src/db/queries/categories.js");
    const { initDatabase, getDb } = await import("@/src/db/database.js");

    await initDatabase();
    const db = getDb();

    // Check database connection
    const dbCheck = await db.query("SELECT 1 as connected");
    const isConnected =
      dbCheck.rows?.[0]?.connected === 1 || dbCheck[0]?.connected === 1;

    // Get embeddings count
    const embeddingsResult = await db.query(
      `SELECT COUNT(*) as total, COUNT(embedding) as with_embedding
       FROM examples`
    );
    const embeddingsData =
      embeddingsResult.rows?.[0] || embeddingsResult[0] || {};

    // Get categories count
    const categoriesResult = await db.query(
      "SELECT COUNT(*) as count FROM categories"
    );
    const categoriesCount =
      categoriesResult.rows?.[0]?.count || categoriesResult[0]?.count || 0;

    // Try to load embeddings
    let loadedEmbeddings = {};
    let loadedCategories = [];
    try {
      loadedEmbeddings = await getAllEmbeddings();
      loadedCategories = await getAllCategories();
    } catch (err) {
      console.error("Error loading embeddings:", err);
    }

    const status = {
      timestamp: new Date().toISOString(),
      environment: {
        isVercel: process.env.VERCEL === "1",
        nodeEnv: process.env.NODE_ENV,
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasOpenAiKey: !!OPENAI_API_KEY,
        embeddingModel:
          process.env.EMBEDDING_MODEL || "text-embedding-3-large (default)",
      },
      database: {
        connected: isConnected,
        categories: categoriesCount,
        examples: {
          total: parseInt(embeddingsData.total) || 0,
          withEmbeddings: parseInt(embeddingsData.with_embedding) || 0,
          withoutEmbeddings:
            (parseInt(embeddingsData.total) || 0) -
            (parseInt(embeddingsData.with_embedding) || 0),
        },
      },
      loaded: {
        categoriesCount: Object.keys(loadedEmbeddings).length,
        totalExamples: Object.values(loadedEmbeddings).reduce(
          (sum, exs) => sum + (exs?.length || 0),
          0
        ),
        categories: Object.keys(loadedEmbeddings).map((cat) => ({
          name: cat,
          examplesCount: loadedEmbeddings[cat]?.length || 0,
        })),
      },
      status: Object.keys(loadedEmbeddings).length > 0 ? "ready" : "not_ready",
      message:
        Object.keys(loadedEmbeddings).length > 0
          ? "Embeddings are loaded and ready for classification"
          : "No embeddings loaded. Recompute embeddings to enable local classification.",
    };

    return NextResponse.json(status, {
      status: status.status === "ready" ? 200 : 503,
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: "error",
        error: error.message,
        environment: {
          isVercel: process.env.VERCEL === "1",
          hasPostgresUrl: !!process.env.POSTGRES_URL,
        },
      },
      { status: 500 }
    );
  }
}
