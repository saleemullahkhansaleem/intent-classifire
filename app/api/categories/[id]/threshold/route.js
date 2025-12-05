import { NextResponse } from "next/server";
import {
  getCategoryById,
  updateCategoryThreshold,
} from "@/src/db/queries/categories.js";
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

    const category = await getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ threshold: category.threshold });
  } catch (error) {
    console.error("Error fetching threshold:", error);
    return NextResponse.json(
      { error: "Failed to fetch threshold", details: error.message },
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
    const { threshold } = body;

    if (threshold === undefined || threshold === null) {
      return NextResponse.json(
        { error: "Threshold value is required" },
        { status: 400 }
      );
    }

    const thresholdValue = parseFloat(threshold);
    if (isNaN(thresholdValue) || thresholdValue < 0 || thresholdValue > 1) {
      return NextResponse.json(
        { error: "Threshold must be between 0.0 and 1.0" },
        { status: 400 }
      );
    }

    const updatedCategory = await updateCategoryThreshold(
      categoryId,
      thresholdValue
    );

    return NextResponse.json({
      message: "Threshold updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating threshold:", error);
    return NextResponse.json(
      { error: "Failed to update threshold", details: error.message },
      { status: 500 }
    );
  }
}
