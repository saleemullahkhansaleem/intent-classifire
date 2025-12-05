import { NextResponse } from "next/server";
import { addExampleToLabel } from "@/src/labelsManager.js";

export async function POST(request, { params }) {
  try {
    const { labelName } = params;
    const body = await request.json();
    const { example } = body;

    if (!example) {
      return NextResponse.json(
        { error: "Example is required" },
        { status: 400 }
      );
    }

    const updatedLabel = addExampleToLabel(labelName, example);

    return NextResponse.json({
      message: "Example added successfully!",
      label: updatedLabel,
    });
  } catch (error) {
    console.error("Error adding example:", error);

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
      { error: "Failed to add example", details: error.message },
      { status: 400 }
    );
  }
}
