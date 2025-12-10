import { NextResponse } from "next/server";
import { initDatabase } from "@/src/db/database.js";
import { getAllCategoriesWithStatus } from "@/src/db/queries/categories.js";

export async function GET() {
    try {
        await initDatabase();
        const categories = await getAllCategoriesWithStatus();

        let totalExamples = 0;
        let computedExamples = 0;
        const byCategory = [];

        for (const category of categories) {
            const examplesCount = category.examplesCount || 0;
            const computedCount = category.computedCount || 0;
            const uncomputedCount = category.uncomputedCount || 0;

            totalExamples += examplesCount;
            computedExamples += computedCount;

            byCategory.push({
                id: category.id,
                name: category.name,
                total: examplesCount,
                computed: computedCount,
                uncomputed: uncomputedCount,
                completionPercentage: examplesCount === 0 ? 0 : Math.round((computedCount / examplesCount) * 100),
                status: examplesCount === 0 ? "empty" : computedCount === 0 ? "none" : computedCount === examplesCount ? "complete" : "partial"
            });
        }

        const completionPercentage = totalExamples === 0 ? 0 : Math.round((computedExamples / totalExamples) * 100);
        const isComplete = (totalExamples - computedExamples) === 0 && totalExamples > 0;

        return NextResponse.json({
            totalExamples,
            computedExamples,
            uncomputedExamples: totalExamples - computedExamples,
            completionPercentage,
            isComplete,
            byCategory
        });
    } catch (error) {
        console.error("Error getting embedding status:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
