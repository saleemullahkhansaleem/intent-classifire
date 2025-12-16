import { NextResponse } from "next/server";
import { getCategoryById } from "@/src/db/queries/categories.js";
import {
  bulkCreateExamples,
  bulkDeleteExamples,
} from "@/src/db/queries/examples.js";
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
    const { examples } = body;

    if (!Array.isArray(examples) || examples.length === 0) {
      return NextResponse.json(
        { error: "Examples must be a non-empty array" },
        { status: 400 }
      );
    }

    // Filter valid examples
    const validExamples = examples
      .filter((ex) => typeof ex === "string" && ex.trim() !== "")
      .map((ex) => ex.trim());

    if (validExamples.length === 0) {
      return NextResponse.json(
        { error: "No valid examples provided" },
        { status: 400 }
      );
    }

    const results = await bulkCreateExamples(categoryId, validExamples);
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Bulk import completed: ${successCount} succeeded, ${failureCount} failed`,
      successCount,
      failureCount,
      results,
    });
  } catch (error) {
    console.error("Error bulk creating examples:", error);
    return NextResponse.json(
      { error: "Failed to bulk create examples", details: error.message },
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

    const body = await request.json();
    const { exampleIds } = body;

    if (!Array.isArray(exampleIds) || exampleIds.length === 0) {
      return NextResponse.json(
        { error: "exampleIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Filter valid IDs
    const validIds = exampleIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "No valid example IDs provided" },
        { status: 400 }
      );
    }

    const result = await bulkDeleteExamples(validIds);

    return NextResponse.json({
      message: `Bulk deletion completed: ${result.deleted} examples deleted`,
      deleted: result.deleted,
    });
  } catch (error) {
    console.error("Error bulk deleting examples:", error);
    return NextResponse.json(
      { error: "Failed to bulk delete examples", details: error.message },
      { status: 500 }
    );
  }
}
