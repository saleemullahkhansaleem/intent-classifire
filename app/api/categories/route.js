import { NextResponse } from "next/server";
import {
  getAllCategories,
  getAllCategoriesWithStatus,
  createCategory,
} from "@/src/db/queries/categories.js";
import { ensureDbInitialized } from "@/src/db/utils.js";

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
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await createCategory(
      name,
      description || null
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
