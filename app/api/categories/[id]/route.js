import { NextResponse } from "next/server";
import {
  getCategoryById,
  getCategoryWithEmbeddingStatus,
  updateCategory,
  deleteCategory,
} from "@/src/db/queries/categories.js";
import { getExamplesByCategoryIdLightweight } from "@/src/db/queries/examples.js";
import { initDatabase } from "@/src/db/database.js";

let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

export async function GET(request, { params }) {
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

    const category = await getCategoryWithEmbeddingStatus(categoryId);
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Include examples without embedding data for fast loading (lightweight query)
    const examples = await getExamplesByCategoryIdLightweight(categoryId);
    category.examples = examples;

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Failed to fetch category", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
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

    const body = await request.json();
    const updates = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.threshold !== undefined) {
      const threshold = parseFloat(body.threshold);
      if (isNaN(threshold) || threshold < 0 || threshold > 1) {
        return NextResponse.json(
          { error: "Threshold must be between 0.0 and 1.0" },
          { status: 400 }
        );
      }
      updates.threshold = threshold;
    }

    const updatedCategory = await updateCategory(categoryId, updates);

    return NextResponse.json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
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

    // Check if category exists
    const category = await getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    await deleteCategory(categoryId);

    return NextResponse.json({
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Failed to delete category", details: error.message },
      { status: 500 }
    );
  }
}
