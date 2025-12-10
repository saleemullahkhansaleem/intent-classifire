# Quick Reference: Vector File Update Flow

## The Problem in 10 Seconds

```
Add Example → Recompute → Classify = GPT Fallback ❌

Why? Vector file updated in storage, but server's memory not refreshed
```

## The Fix in 10 Seconds

```
Add Example → Recompute → [RELOAD MEMORY] → Classify = Match! ✅

How? Force reload embeddings after saving to storage
```

---

## 3 Cache Layers (Must Know)

| Layer | Where | Who Clears It | Who Uses It |
|-------|-------|---------------|------------|
| **Layer 1** | blobService cache | After recompute | loadEmbeddingsFromStorage() |
| **Layer 2** | classifier.embeddings | **NOW: After recompute** | classifyText() |
| **Layer 3** | Vercel Blob | Never (persists) | Source of truth |

---

## Before vs After

### BEFORE (Broken)
```
Recompute:
  1. Compute embeddings ✓
  2. Save to Blob ✓
  3. Clear Layer 1 ✓
  4. DON'T reload Layer 2 ❌ ← PROBLEM!

Classify:
  Uses stale Layer 2 → GPT fallback ❌
```

### AFTER (Fixed)
```
Recompute:
  1. Compute embeddings ✓
  2. Save to Blob ✓
  3. Clear Layer 1 ✓
  4. Reload Layer 2 ✓ ← FIX!

Classify:
  Uses fresh Layer 2 → Matches! ✅
```

---

## One-Line Summary

**Changed**: Moved `reloadEmbeddings()` to run AFTER `saveEmbeddings()` + `invalidateCache()`

**File**: `src/embeddingService.js` line 293

**Effect**: New examples now available for classification immediately after recompute

---

## Expected Behavior After Deploy

```
Timeline:
─────────────────────────────────────────────────

Server starts:
  Load embeddings from Blob → Ready ✓

You add example:
  POST /api/categories/4/examples → Saved to DB ✓

You recompute:
  POST /api/recompute → [Computing...] → [Saving...] → [Reloading...] ✓
  Check logs: "[Recompute] Forcing embeddings reload after save..."

You classify:
  POST /api/classify (same text) → Matches! ✅
```

---

## Testing Checklist

```
□ Build passes: npm run build
□ Deploy: git push origin main
□ Add example: POST /api/categories/{id}/examples
□ Recompute: POST /api/recompute
□ Check logs for: "[Recompute] Forcing embeddings reload..."
□ Classify: POST /api/classify (same text)
□ Verify: { category: "X", similarity: >0.8 } NOT GPT fallback
□ Test other categories too
```

---

## Logs to Look For

### ✅ Good Signs
```
[Recompute] Forcing embeddings reload after save...
[Reload] Reloading embeddings from database...
[Reload] Found X categories with embeddings
[Classify] Loaded embeddings from cache (X categories)
```

### ❌ Bad Signs
```
[Recompute] Failed to save embeddings
[Reload] Database has no embeddings
[Classify] Error checking cached embeddings
```

---

## Performance

| Action | Time | Before | After |
|--------|------|--------|-------|
| Classify | 1-2s | Same | Same |
| Recompute | 30-60s | Same | Same |
| New example works | N/A | ❌ No | ✅ Yes |

---

## Troubleshooting

**Still getting GPT fallback?**
```
→ Run recompute again
→ Wait 5 seconds
→ Try classify again
→ Check logs for "[Recompute] Forcing embeddings reload..."
```

**Build failed?**
```
→ npm run build locally to check
→ Verify all imports correct
→ Rollback: git revert HEAD && git push origin main
```

**Blob not updating?**
```
→ Check BLOB_READ_WRITE_TOKEN in Vercel env vars
→ Verify Vercel Blob dashboard
→ Try recompute again
```

---

## Code Change (Exact)

**Location**: `src/embeddingService.js` lines 281-294

**Before**:
```javascript
if (!wasTimeout && !wasLimited) {
  await reloadEmbeddings();  // ← Too early
  await saveEmbeddings(freshEmbeddings);
  invalidateCache();  // ← Only clears Layer 1
}
```

**After**:
```javascript
if (!wasTimeout && !wasLimited) {
  await saveEmbeddings(freshEmbeddings);
  invalidateCache();  // ← Clear Layer 1
  await reloadEmbeddings();  // ← Now reload Layer 2 ✓
}
```

---

## Deployment Command

```bash
git add src/embeddingService.js
git commit -m "Fix: Force reload embeddings after save to sync cache layers"
git push origin main
```

---

## More Info

- **Detailed Explanation**: CACHE_LAYERS_EXPLAINED.md
- **Complete Timeline**: CACHE_UPDATE_FLOW.md  
- **Deployment Steps**: DEPLOYMENT_CHECKLIST.md
- **Full Summary**: VECTOR_SYNC_FIX_SUMMARY.md

