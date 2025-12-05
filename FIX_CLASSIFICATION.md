# Fix: Classification Not Using Local Embeddings

## Problem Identified ✅

From your server logs:

- **Score: 0.0728** (should be close to 1.0 for exact match like "what is 2+2")
- **Best match: web_surfing** (should be low_effort)
- **Using GPT fallback** (should use local classification)

## Root Cause 🔍

The embeddings stored in your database were created with a **different embedding model** than what's currently being used for classification. Embeddings from different models have incompatible vector spaces, causing very low similarity scores (0.0728 instead of ~0.95-1.0).

## Solution ✅

**RECOMPUTE all embeddings** using the current embedding model (`text-embedding-3-large`).

### Step-by-Step Fix

1. **Go to your app** → Click the **"Manage"** tab
2. **Click "Recompute Embeddings"** button (top right, next to "New Category")
3. **Wait** for it to complete (~1-2 minutes for 200 examples)
4. **Test again** with "what is 2+2" - it should now work correctly!

### Option 2: Via API Call

You can trigger recomputation via API:

```bash
curl -X POST http://localhost:3000/api/recompute
```

Or if your app is running, you can use the browser console:

```javascript
fetch("/api/recompute", { method: "POST" })
  .then((r) => r.json())
  .then(console.log);
```

### Option 3: Add Recompute Button

If you don't have a recompute button in the UI, we can add one to the CategoryManager component.

## After Recomputation

Once embeddings are recomputed:

1. The similarity score for "what is 2+2" should be **~0.95-1.0** (near perfect match)
2. It should correctly classify as **low_effort** (not web_surfing)
3. It should use **LOCAL** classification (not GPT fallback)

## Expected Cost

Recomputing ~200 examples will cost approximately:

- **$0.03 - $0.04** (very cheap)
- Uses `text-embedding-3-large` model
- Takes about 1-2 minutes

## Verification

After recomputation, test again with "what is 2+2" and check server logs. You should see:

```
[Classify] Best match: low_effort (score: 0.9XXX, threshold: 0.4)
[Classify] ✅ Using LOCAL classification
```
