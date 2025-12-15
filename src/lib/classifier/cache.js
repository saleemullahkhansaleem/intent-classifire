/**
 * Classifier Cache Singleton
 * Holds embeddings in memory and ensures synchronization with database.
 */

let embeddings = {};
let categoryThresholds = {};
let isInitialized = false;

// Statistics for monitoring
let lastLoadTime = 0; // Timestamp
let itemCount = 0;

// Vercel Serverless Cache Invalidation Strategy:
// We store a global content timestamp in the database (settings table).
// If the cache's lastLoadTime < DB timestamp, we must reload.
// Reduced TTL so recompute changes propagate more quickly to warm instances.
const CACHE_TTL_MS = 10000; // Check DB every 10 seconds if cache is warm
let lastCheckTime = 0;

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
      const { initDatabase } = await import("../../db/database.js");
      const { getAllEmbeddings } = await import("../../db/queries/embeddings.js");
      const { getAllCategories } = await import("../../db/queries/categories.js");
      const { getSetting, updateSetting } = await import("../../db/queries/settings.js"); // NEW

      await initDatabase();

      const dbEmbeddings = await getAllEmbeddings();
      const categories = await getAllCategories();

      if (dbEmbeddings) {
        embeddings = dbEmbeddings;
        categoryThresholds = {};
        for (const cat of categories) {
          categoryThresholds[cat.name] = cat.threshold || 0.4;
        }

        itemCount = Object.values(embeddings).reduce(
          (sum, exs) => sum + (Array.isArray(exs) ? exs.length : 0),
          0
        );

        lastLoadTime = Date.now();
        lastCheckTime = Date.now();
        isInitialized = true;

        // Update global timestamp in DB so other instances know to reload
        // converting to string for DB storage
        await updateSetting('embeddings_updated_at', lastLoadTime.toString());

        console.log(`${logPrefix} ✅ Loaded ${Object.keys(embeddings).length} categories, ${itemCount} embeddings.`);
      } else {
        console.warn(`${logPrefix} ⚠️ No embeddings found in database.`);
        embeddings = {};
        itemCount = 0;
      }
    } catch (err) {
      console.error(`${logPrefix} ❌ Reload failed:`, err.message);
    }
  },

  /**
   * Initialize only if not already initialized.
   */
  async init() {
    if (isInitialized) {
        await this.checkFreshness();
        return;
    }
    await this.reload();
  },

  /**
   * Check if we need to reload based on DB timestamp.
   * Only checks periodically to save DB calls.
   */
  async checkFreshness() {
    const now = Date.now();
    if (now - lastCheckTime < CACHE_TTL_MS) return; // Too soon to check

    try {
        const { getSetting } = await import("../../db/queries/settings.js");
        const lastUpdateStr = await getSetting('embeddings_updated_at');
        if (lastUpdateStr) {
            const dbTimestamp = parseInt(lastUpdateStr, 10);
            if (dbTimestamp > lastLoadTime) {
                console.log(`${logPrefix} 🔄 Detected stale cache (DB: ${dbTimestamp} > Local: ${lastLoadTime}). Reloading...`);
                await this.reload();
            }
        }
        lastCheckTime = now;
    } catch (e) {
        console.warn(`${logPrefix} Freshness check failed:`, e.message);
    }
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
   * Force clear
   */
  clear() {
    embeddings = {};
    categoryThresholds = {};
    isInitialized = false;
    itemCount = 0;
    console.log(`${logPrefix} cleared.`);
  }
};
