import { NextResponse } from "next/server";
import { updateAllCategoriesThreshold } from "@/src/db/queries/categories.js";
import { initDatabase } from "@/src/db/database.js";

let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

export async function PUT(request) {
  try {
    await ensureDbInitialized();
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

    const updatedCategories = await updateAllCategoriesThreshold(
      thresholdValue
    );

    return NextResponse.json({
      message: "Threshold updated successfully for all categories",
      count: updatedCategories.length,
      threshold: thresholdValue,
    });
  } catch (error) {
    console.error("Error updating global threshold:", error);
    return NextResponse.json(
      { error: "Failed to update global threshold", details: error.message },
      { status: 500 }
    );
  }
}
