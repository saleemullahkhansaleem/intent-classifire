import { NextResponse } from "next/server";
import {
  getAllCategories,
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
    const categories = await getAllCategories();

    // Optimize: Get example counts with a single SQL query instead of multiple queries
    const { getDb } = await import("@/src/db/database.js");
    const db = getDb();

    // Get counts for all categories in one query
    const countsResult = await db.query(
      `SELECT category_id, COUNT(*) as count
       FROM examples
       GROUP BY category_id`
    );

    const countsMap = {};
    const rows = countsResult.rows || countsResult;
    for (const row of rows) {
      countsMap[row.category_id] = parseInt(row.count) || 0;
    }

    // Include examples count for each category
    const categoriesWithCounts = categories.map((category) => ({
      ...category,
      examplesCount: countsMap[category.id] || 0,
    }));

    return NextResponse.json(categoriesWithCounts);
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
