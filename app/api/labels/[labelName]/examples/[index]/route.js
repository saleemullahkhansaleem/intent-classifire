import { NextResponse } from "next/server";
import { updateExample, deleteExample } from "@/src/labelsManager.js";
import { recomputeEmbeddings } from "@/src/embeddingService.js";

export async function PUT(request, { params }) {
  try {
    const { labelName, index } = params;
    const body = await request.json();
    const { example } = body;

    if (!example) {
      return NextResponse.json(
        { error: "Example is required" },
        { status: 400 }
      );
    }

    const idx = parseInt(index, 10);
    if (isNaN(idx)) {
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    }

    const updatedLabel = await updateExample(labelName, idx, example);

    // Trigger recomputation (don't wait for it to complete)
    recomputeEmbeddings().catch((err) => {
      console.error("Error recomputing embeddings in background:", err);
    });

    return NextResponse.json({
      message:
        "Example updated successfully. Embeddings are being recomputed in the background.",
      label: updatedLabel,
    });
  } catch (error) {
    console.error("Error updating example:", error);

    // Check if it's a read-only filesystem error
    if (error.message && error.message.includes("read-only")) {
      return NextResponse.json(
        {
          error: "File writes not supported in serverless environment",
          details: error.message,
          suggestion:
            "Please update data/labels.json in your repository and redeploy, or use a database/storage solution.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update example", details: error.message },
      { status: 400 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { labelName, index } = params;
    const idx = parseInt(index, 10);

    if (isNaN(idx)) {
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    }

    const updatedLabel = await deleteExample(labelName, idx);

    // Trigger recomputation (don't wait for it to complete)
    recomputeEmbeddings().catch((err) => {
      console.error("Error recomputing embeddings in background:", err);
    });

    return NextResponse.json({
      message:
        "Example deleted successfully. Embeddings are being recomputed in the background.",
      label: updatedLabel,
    });
  } catch (error) {
    console.error("Error deleting example:", error);

    // Check if it's a read-only filesystem error
    if (error.message && error.message.includes("read-only")) {
      return NextResponse.json(
        {
          error: "File writes not supported in serverless environment",
          details: error.message,
          suggestion:
            "Please update data/labels.json in your repository and redeploy, or use a database/storage solution.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete example", details: error.message },
      { status: 400 }
    );
  }
}
