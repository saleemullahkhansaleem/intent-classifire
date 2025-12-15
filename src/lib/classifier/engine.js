/**
 * Classification Engine
 * Optimized for speed using pure functions.
 */

/**
 * Calculate cosine similarity between two vectors
 * @param {Array<number>} vecA
 * @param {Array<number>} vecB
 * @returns {number} Similarity score (-1 to 1)
 */
export function cosineSimilarity(vecA, vecB) {
  // Performance optimization: Assume vectors are same length and validated by caller
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  const length = vecA.length;
  for (let i = 0; i < length; i++) {
    const valA = vecA[i];
    const valB = vecB[i];
    dotProduct += valA * valB;
    magnitudeA += valA * valA;
    magnitudeB += valB * valB;
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

/**
 * Find best matching category for an input embedding
 * @param {Array<number>} inputEmbedding
 * @param {Object} embeddingsCache - Structure: { categoryName: [ { vector: [...] }, ... ] }
 * @returns {Object} { label: string|null, score: number }
 */
export function findBestMatch(inputEmbedding, embeddingsCache) {
  let bestMatch = { label: null, score: -1 };

  // Iterate over categories
  for (const categoryName in embeddingsCache) {
    const examples = embeddingsCache[categoryName];
    // Fast skip for empty categories
    if (!examples || examples.length === 0) continue;

    // Iterate over examples in this category
    // Using simple for loop for max speed
    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      // Supports both cached format { vector: [...] } and raw array (legacy)
      const vector = example.vector || example;

      const similarity = cosineSimilarity(inputEmbedding, vector);

      if (similarity > bestMatch.score) {
        bestMatch.label = categoryName;
        bestMatch.score = similarity;
      }
    }
  }

  return bestMatch;
}
