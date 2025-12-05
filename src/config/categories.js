// src/config/categories.js
// Universal categories configuration

/**
 * Get all valid category names from database
 * This should be called dynamically to ensure categories are always in sync
 */
export async function getValidCategoryNames() {
  try {
    const { getAllCategories } = await import("../db/queries/categories.js");
    const categories = await getAllCategories();
    return categories.map((cat) => cat.name);
  } catch (error) {
    console.error("Error loading categories from database:", error);
    // Fallback to default categories if DB not available
    return getDefaultCategoryNames();
  }
}

/**
 * Default category names (fallback)
 */
export function getDefaultCategoryNames() {
  return [
    "low_effort",
    "reasoning",
    "code",
    "image_generation",
    "image_edit",
    "web_surfing",
    "ppt_generation",
  ];
}

/**
 * Validate if a category name is valid
 */
export async function isValidCategory(categoryName) {
  const validNames = await getValidCategoryNames();
  return validNames.includes(categoryName);
}

/**
 * Get category metadata (for GPT fallback prompt generation)
 */
export async function getCategoriesForPrompt() {
  try {
    const { getAllCategories } = await import("../db/queries/categories.js");
    const categories = await getAllCategories();
    return categories.map((cat) => ({
      name: cat.name,
      description: cat.description || "",
    }));
  } catch (error) {
    console.error("Error loading categories for prompt:", error);
    return getDefaultCategories();
  }
}

/**
 * Default categories (fallback)
 */
function getDefaultCategories() {
  return [
    { name: "low_effort", description: "Short, simple queries" },
    { name: "reasoning", description: "Complex questions requiring reasoning" },
    { name: "code", description: "Programming and coding queries" },
    {
      name: "image_generation",
      description: "Requests to generate new images",
    },
    { name: "image_edit", description: "Requests to modify images" },
    { name: "web_surfing", description: "Queries to search the web" },
    {
      name: "ppt_generation",
      description: "Requests to generate presentations",
    },
  ];
}
