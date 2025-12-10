import { NextResponse } from "next/server";
import {
  getAllCategories,
  getAllCategoriesWithStatus,
  createCategory,
} from "@/src/db/queries/categories.js";
import { initDatabase } from "@/src/db/database.js";

// Initialize database on first import
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

export async function GET() {
  try {
    await ensureDbInitialized();
    const categories = await getAllCategoriesWithStatus();

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const { name, description, threshold } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await createCategory(
      name,
      description || null,
      threshold || 0.4
    );

    return NextResponse.json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Error creating category:", error);

    if (error.message && error.message.includes("UNIQUE constraint")) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create category", details: error.message },
      { status: 500 }
    );
  }
}
