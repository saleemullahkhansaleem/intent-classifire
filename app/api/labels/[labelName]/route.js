import { NextResponse } from "next/server";
import { getLabelByName } from "@/src/labelsManager.js";

export async function GET(request, { params }) {
  try {
    const { labelName } = params;
    const label = await getLabelByName(labelName);

    if (!label) {
      return NextResponse.json(
        { error: `Label "${labelName}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(label);
  } catch (error) {
    console.error("Error fetching label:", error);
    return NextResponse.json(
      { error: "Failed to fetch label", details: error.message },
      { status: 500 }
    );
  }
}
