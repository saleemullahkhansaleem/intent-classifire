// src/db/migrations/migrateFromJson.js
// Migrate data from labels.json to database

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "../database.js";
import { getAllCategories } from "../queries/categories.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function migrateFromJson(options = {}) {
  const { force = false } = options;
  const db = getDb();
  const projectRoot = path.resolve(__dirname, "../../../");

  const labelsPath = path.resolve(projectRoot, "data", "labels.json");

  if (!fs.existsSync(labelsPath)) {
    console.log("No labels.json file found. Skipping JSON migration.");
    return;
  }

  const labels = JSON.parse(fs.readFileSync(labelsPath, "utf-8"));

  // Check if database already has categories
  const existingCategories = await getAllCategories();

  if (existingCategories.length > 0 && !force) {
    console.log("Database already has categories. Skipping JSON migration.");
    console.log("Use --force flag to clear existing data and re-migrate.");
    return;
  }

  // If force flag is set, clear existing data
  if (force && existingCategories.length > 0) {
    console.log("Force mode: Clearing existing categories and examples...");
    await db.execute("DELETE FROM examples");
    await db.execute("DELETE FROM categories");
    console.log("Existing data cleared.");
  }

  console.log(`Migrating ${labels.length} categories from JSON...`);

  let totalExamples = 0;

  for (const label of labels) {
    // Check if category already exists (in case of partial migration)
    const existingCategory = existingCategories.find(
      (c) => c.name === label.name
    );

    let categoryId;

    if (existingCategory && !force) {
      // Category exists, skip or update?
      console.log(`Category "${label.name}" already exists. Skipping...`);
      categoryId = existingCategory.id;
    } else {
      // Insert category
      const categoryResult = await db.query(
        `INSERT INTO categories (name, description, threshold)
         VALUES ($1, $2, $3) RETURNING id`,
        [label.name, label.description || null, 0.4]
      );

      const rows = categoryResult.rows || categoryResult;
      categoryId = rows[0].id;
    }

    // Insert examples (only if category was just created or force mode)
    if (label.examples && label.examples.length > 0) {
      // Get existing examples for this category
      const { getExamplesByCategoryId } = await import(
        "../queries/examples.js"
      );
      const existingExamples = await getExamplesByCategoryId(categoryId);
      const existingTexts = new Set(existingExamples.map((ex) => ex.text));

      let addedCount = 0;
      for (const exampleText of label.examples) {
        // Skip if example already exists
        if (existingTexts.has(exampleText)) {
          continue;
        }

        await db.execute(
          `INSERT INTO examples (category_id, text)
           VALUES ($1, $2)`,
          [categoryId, exampleText]
        );
        addedCount++;
      }

      totalExamples += addedCount;
      console.log(
        `Migrated category: ${label.name} (${addedCount} new examples, ${existingExamples.length} existing)`
      );
    } else {
      console.log(`Migrated category: ${label.name} (0 examples)`);
    }
  }

  console.log(`\n✅ JSON migration completed successfully!`);
  console.log(`   - Categories: ${labels.length}`);
  console.log(`   - Total examples added: ${totalExamples}`);
}
