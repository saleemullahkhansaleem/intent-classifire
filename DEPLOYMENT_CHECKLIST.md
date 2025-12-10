# Deployment Checklist & Testing Guide

## The Fix Applied

**File**: `src/embeddingService.js` (Line ~293)

**Change**: Added `await reloadEmbeddings()` after saving embeddings to Blob

**Why**: Ensures the in-memory `embeddings` variable in classifier.js stays in sync with the Blob storage, so new examples are immediately available for classification.

---

## Pre-Deployment Checklist

- [x] Fix applied to src/embeddingService.js
- [x] Build passes without errors (`npm run build`)
- [x] All imports correct (reloadEmbeddings imported from classifier.js)
- [x] No breaking changes
- [x] Cache invalidation logic correct
- [x] Error handling in place

---

## Deployment Steps

### 1. Commit and Push

```bash
# Stage changes
git add -A

# Commit with message
git commit -m "Fix: Force reload embeddings after save to sync cache layers

- After recomputing embeddings and saving to Blob, force reload
- Ensures embeddings variable stays in sync with storage
- Fixes issue where new examples fell back to GPT"

# Push to Vercel
git push origin main
```

### 2. Verify Deployment

- Go to Vercel dashboard
- Check build status (should complete in 30-60 seconds)
- Look for: `✓ Compiled successfully`

### 3. Test the Flow

#### Test Case 1: New Example Classification

```bash
# 1. Add a new example to billing category
curl -X POST https://your-vercel-url/api/categories/4/examples \
  -H "Content-Type: application/json" \
  -d '{
    "example": "Why is my invoice so high?"
  }'

# Expected: { success: true, id: X }

# 2. Recompute embeddings
curl -X POST https://your-vercel-url/api/recompute

# Expected: "Embeddings computed successfully!"
# Check logs for: "[Recompute] Forcing embeddings reload after save..."

# 3. Classify with same text
curl -X POST https://your-vercel-url/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Why is my invoice so high?"
  }'

# Expected: { category: "billing", similarity: 0.85+, matched: true }
# NOT: { category: "general", fallback: "gpt", ... }
```

#### Test Case 2: Multiple Categories

```bash
# Add examples to different categories
curl -X POST https://your-vercel-url/api/categories/1/examples \
  -H "Content-Type: application/json" \
  -d '{ "example": "Feature request example" }'

curl -X POST https://your-vercel-url/api/categories/2/examples \
  -H "Content-Type: application/json" \
  -d '{ "example": "Support ticket example" }'

# Recompute
curl -X POST https://your-vercel-url/api/recompute

# Test each category
curl -X POST https://your-vercel-url/api/classify \
  -H "Content-Type: application/json" \
  -d '{ "prompt": "Feature request example" }'
# Should match category 1

curl -X POST https://your-vercel-url/api/classify \
  -H "Content-Type: application/json" \
  -d '{ "prompt": "Support ticket example" }'
# Should match category 2
```

#### Test Case 3: GPT Fallback Still Works

```bash
# Send ambiguous text that doesn't match any examples
curl -X POST https://your-vercel-url/api/classify \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "xyzabc123 random text with no meaning"
  }'

# Expected: Falls back to GPT
# { category: "general", fallback: "gpt", ... }
```

---

## Monitoring

### What to Look For in Vercel Logs

#### ✅ Expected Logs After Recompute

```
[Recompute] Processing category 'billing' with X examples
[Recompute] Computed X new embeddings
[Recompute] Forcing embeddings reload after save...
[Reload] Reloading embeddings from database...
[Reload] Found X categories with embeddings
[Classify] Loaded embeddings from cache (X categories)
```

#### ❌ Warning Signs

```
[Recompute] Failed to save embeddings: ...
  → Check BLOB_READ_WRITE_TOKEN is set

[Classify] Error checking cached embeddings: ...
  → Check cache invalidation logic

[Reload] Database has no embeddings
  → Check DATABASE_URL and Postgres connection

Fallback to GPT immediately after recompute
  → Cache sync issue (run recompute again)
```

---

## Performance Expectations

### Before Fix
- Add example → Recompute → Classify = **Falls back to GPT** ❌
- Average time: 3-5 seconds (GPT computation)

### After Fix
- Add example → Recompute → Classify = **Matches category** ✅
- Average time: 1-2 seconds (vector comparison only)

### Metrics to Monitor

| Endpoint | Expected Time | Before | After |
|----------|---|---|---|
| POST /api/classify | 1-2s | 3-5s (GPT) | 1-2s (vector) |
| POST /api/recompute | 30-60s | Same | Same |
| New example → Match | 2-3s | Never works ❌ | Works ✅ |

---

## Troubleshooting

### Issue: Still Getting GPT Fallback After Recompute

**Possible Causes**:
1. Cache not being invalidated
2. Reload not happening
3. Old server instance still running

**Solutions**:
```bash
# Check logs for reload message
curl https://your-vercel-url/api/health/embeddings

# Force reload by recomputing again
curl -X POST https://your-vercel-url/api/recompute

# Wait 30 seconds for cache to refresh, then test
sleep 30
curl -X POST https://your-vercel-url/api/classify ...
```

### Issue: Build Fails After Deployment

**Check**:
1. `npm run build` passes locally
2. All imports are correct
3. No syntax errors

**Fix**:
```bash
# Rollback
git revert HEAD
git push origin main

# Or fix and redeploy
git add .
git commit -m "Fix: [description]"
git push origin main
```

### Issue: Blob Storage Not Updating

**Verify**:
1. BLOB_READ_WRITE_TOKEN is set in Vercel
2. Not in read-only mode
3. Check Vercel Blob dashboard for file updates

```bash
# Test Blob write access
curl -X POST https://your-vercel-url/api/recompute
# Check if classifier-embeddings.json timestamp changes
```

---

## Rollback Plan

If issues arise:

```bash
# Identify the previous working commit
git log --oneline -n 10

# Revert to previous version
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push origin main --force
```

---

## Documentation References

For more details, see:
- `CACHE_UPDATE_FLOW.md` - Detailed timeline and flow
- `CACHE_LAYERS_EXPLAINED.md` - Visual diagrams
- `VECTOR_UPDATE_FIX.md` - Quick summary
- `DEPLOYMENT.md` - General deployment guide
- `QUICK_REF.md` - Quick commands reference

---

## Success Criteria

✅ Deployment successful when:
1. Build completes without errors
2. New examples immediately available after recompute
3. Classification matches examples (no unexpected GPT fallback)
4. Logs show "[Recompute] Forcing embeddings reload after save..."
5. Performance is 1-2 seconds per classification

