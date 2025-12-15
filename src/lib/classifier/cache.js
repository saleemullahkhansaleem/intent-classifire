/**
 * Classifier Cache Singleton
 * Holds embeddings in memory and ensures synchronization with database.
 */

let embeddings = {};
let categoryThresholds = {};
let isInitialized = false;

// Statistics for monitoring
let lastLoadTime = null;
let itemCount = 0;

const logPrefix = "[Classifier Cache]";

export const ClassifierCache = {
  /**
   * Load or reload embeddings from the database.
   * This is the SOURCE OF TRUTH.
   * @returns {Promise<void>}
   */
  async reload() {
    console.log(`${logPrefix} Reloading from database...`);

    try {
      // Dynamic imports to avoid circular dependencies if any, and keep this module lightweight until needed
      const { initDatabase } = await import("../../db/database.js");
      const { getAllEmbeddings } = await import("../../db/queries/embeddings.js");
      const { getAllCategories } = await import("../../db/queries/categories.js");

      await initDatabase();
      const dbEmbeddings = await getAllEmbeddings();
      const categories = await getAllCategories();

      // Atomic replacement of in-memory state
      if (dbEmbeddings) {
        embeddings = dbEmbeddings;

        // Update thresholds
        categoryThresholds = {};
        for (const cat of categories) {
          categoryThresholds[cat.name] = cat.threshold || 0.4;
        }

        // Update stats
        itemCount = Object.values(embeddings).reduce(
          (sum, exs) => sum + (Array.isArray(exs) ? exs.length : 0),
          0
        );
        lastLoadTime = new Date();
        isInitialized = true;

        console.log(`${logPrefix} ✅ Loaded ${Object.keys(embeddings).length} categories, ${itemCount} embeddings.`);
      } else {
        console.warn(`${logPrefix} ⚠️ No embeddings found in database.`);
        embeddings = {};
        itemCount = 0;
      }
    } catch (err) {
      console.error(`${logPrefix} ❌ Failed to reload:`, err.message);
      // If we fail to reload, we generally keep the old cache unless strictly required to clear
      // But if not initialized, we remain uninitialized
    }
  },

  /**
   * Initialize only if not already initialized.
   */
  async init() {
    if (isInitialized) return;
    await this.reload();
  },

  /**
   * Get all embeddings.
   * @returns {Object}
   */
  getEmbeddings() {
    return embeddings;
  },

  /**
   * Get threshold for a specific category.
   * @param {string} category
   * @returns {number}
   */
  getThreshold(category) {
    return categoryThresholds[category] || 0.4;
  },

  /**
   * Check if cache is ready.
   * @returns {boolean}
   */
  isReady() {
    return isInitialized && Object.keys(embeddings).length > 0;
  },

  /**
   * Force clear (mainly for testing)
   */
  clear() {
    embeddings = {};
    categoryThresholds = {};
    isInitialized = false;
    itemCount = 0;
    console.log(`${logPrefix} cleared.`);
  }
};
