import { NextResponse } from "next/server";
import { getCategoryById } from "@/src/db/queries/categories.js";
import { createExample } from "@/src/db/queries/examples.js";
import { ensureDbInitialized } from "@/src/db/utils.js";

export async function POST(request, { params }) {
  try {
    await ensureDbInitialized();
    const { id } = params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { error: "Invalid category ID" },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = await getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { text, example } = body; // Accept both 'text' and 'example' for compatibility

    // Use 'text' if provided, otherwise fall back to 'example'
    const exampleText = text || example;

    if (
      !exampleText ||
      typeof exampleText !== "string" ||
      exampleText.trim() === ""
    ) {
      return NextResponse.json(
        { error: "Example text is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const newExample = await createExample(categoryId, exampleText.trim());

    return NextResponse.json({
      message: "Example added successfully!",
      example: newExample,
    });
  } catch (error) {
    console.error("Error adding example:", error);
    return NextResponse.json(
      { error: "Failed to add example", details: error.message },
      { status: 500 }
    );
  }
}
