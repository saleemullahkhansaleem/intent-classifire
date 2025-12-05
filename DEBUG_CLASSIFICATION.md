# Debug Classification Issue

## Problem

"what is 2+2" is using GPT fallback even though the example exists in database with embedding.

## Verified Facts

✅ Embeddings ARE in database (200 examples have embeddings)
✅ Example "what is 2+2" exists with embedding
✅ Embeddings are in correct format
✅ Database connection works

## Possible Issues

### 1. Embeddings Not Loading in Next.js

Next.js API routes might not be loading embeddings from database properly.

**Check:** Look at server logs when classifying. You should see:

```
✅ Embeddings loaded from database (7 categories)
```

### 2. Similarity Score Below Threshold

The similarity score might be below 0.4 threshold even for exact match.

**Check:** Debug logs will show:

```
[Classify] Best match: low_effort (score: 0.XXXX, threshold: 0.4)
```

### 3. Database Connection Issue

The classifier might be using SQLite instead of Neon when Next.js runs.

**Fix:** Ensure `POSTGRES_URL` is loaded in Next.js API routes.

## Quick Fix

1. **Restart dev server** to ensure fresh initialization
2. **Check server logs** when classifying to see what's happening
3. **Test classification** - you should see debug logs showing:
   - Embeddings loaded count
   - Best match score
   - Threshold comparison

## Test Command

```bash
node scripts/test-classification.js
```

This will test classification with full debugging output.
