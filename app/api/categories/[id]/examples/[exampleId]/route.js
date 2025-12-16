import { NextResponse } from "next/server";
import { getCategoryById } from "@/src/db/queries/categories.js";
import {
  getExampleById,
  updateExample,
  deleteExample,
} from "@/src/db/queries/examples.js";
import { ensureDbInitialized } from "@/src/db/utils.js";

export async function PUT(request, { params }) {
  try {
    await ensureDbInitialized();
    const { id, exampleId } = params;
    const categoryId = parseInt(id, 10);
    const exId = parseInt(exampleId, 10);

    if (isNaN(categoryId) || isNaN(exId)) {
      return NextResponse.json(
        { error: "Invalid category or example ID" },
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

    // Verify example exists and belongs to category
    const existingExample = await getExampleById(exId);
    if (!existingExample) {
      return NextResponse.json({ error: "Example not found" }, { status: 404 });
    }

    if (existingExample.category_id !== categoryId) {
      return NextResponse.json(
        { error: "Example does not belong to this category" },
        { status: 403 }
      );
    }

    const updatedExample = await updateExample(exId, exampleText.trim());

    return NextResponse.json({
      message: "Example updated successfully!",
      example: updatedExample,
    });
  } catch (error) {
    console.error("Error updating example:", error);
    return NextResponse.json(
      { error: "Failed to update example", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await ensureDbInitialized();
    const { id, exampleId } = params;
    const categoryId = parseInt(id, 10);
    const exId = parseInt(exampleId, 10);

    if (isNaN(categoryId) || isNaN(exId)) {
      return NextResponse.json(
        { error: "Invalid category or example ID" },
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

    // Verify example exists and belongs to category
    const existingExample = await getExampleById(exId);
    if (!existingExample) {
      return NextResponse.json({ error: "Example not found" }, { status: 404 });
    }

    if (existingExample.category_id !== categoryId) {
      return NextResponse.json(
        { error: "Example does not belong to this category" },
        { status: 403 }
      );
    }

    await deleteExample(exId);

    return NextResponse.json({
      message: "Example deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting example:", error);
    return NextResponse.json(
      { error: "Failed to delete example", details: error.message },
      { status: 500 }
    );
  }
}
