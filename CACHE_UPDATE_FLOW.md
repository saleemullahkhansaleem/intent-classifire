# Why Vector File Updates Weren't Reflected in Classification

## The Problem You Experienced

1. ✅ Added a new example to a category
2. ✅ Ran `/api/recompute` - embeddings computed and saved to Blob
3. ❌ Classified with that exact prompt - fell back to GPT instead of matching the new example
4. ❌ Vector file was updated, but classifications weren't using it

## Root Cause: 3-Layer Cache Issue

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: In-Memory Cache in blobService.js                │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ cachedEmbeddings = {...}                              │  │
│ │ lastLoadTime = Date.now()                             │  │
│ │ CACHE_DURATION = 30 minutes                           │  │
│ └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: embeddings variable in classifier.js              │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ let embeddings = {                                    │  │
│ │   "support": [{id: 1, vector: [...]}],               │  │
│ │   "billing": [{id: 2, vector: [...]}]                │  │
│ │ }                                                     │  │
│ └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: Blob Storage (Vercel) / Database (Postgres)      │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ Actual source of truth                                │  │
│ └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## What Was Happening (OLD FLOW - BROKEN)

```
USER ADDS EXAMPLE & RECOMPUTES:
┌─────────────────────────────────────┐
│ POST /api/recompute                 │
└─────────────────────────────────────┘
              ↓
    [1] Compute embeddings from database
    [2] Save to Blob storage ✅
    [3] invalidateCache() - clears Layer 1 ❌ INCOMPLETE!
              ↓
    ⚠️ BUT: embeddings variable (Layer 2) STILL has OLD data
              ↓
    ⚠️ AND: Next request doesn't reload, uses cached Layer 2

USER THEN CLASSIFIES:
┌─────────────────────────────────────┐
│ POST /api/classify with new example │
└─────────────────────────────────────┘
              ↓
    [1] Check: embeddings empty? NO (still has old data from Layer 2)
    [2] Skip: cache check (already have Layer 2)
    [3] Skip: reload (not needed according to logic)
              ↓
    [4] Compare with OLD embeddings (don't match new example)
    [5] Score < 0.4 → GPT FALLBACK ❌
```

## The Fix (NEW FLOW - WORKING)

```
USER ADDS EXAMPLE & RECOMPUTES:
┌─────────────────────────────────────┐
│ POST /api/recompute                 │
└─────────────────────────────────────┘
              ↓
    [1] Compute embeddings from database
    [2] Save to Blob storage ✅
    [3] invalidateCache() - clear Layer 1 ✅
    [4] reloadEmbeddings() - reload Layer 2 ✅ NEW!
              ↓
    ✅ NOW: embeddings variable has FRESH data from Blob

USER THEN CLASSIFIES:
┌─────────────────────────────────────┐
│ POST /api/classify with new example │
└─────────────────────────────────────┘
              ↓
    [1] Check: embeddings empty? NO (just reloaded)
    [2] Use current embeddings (includes new example!)
    [3] Compare with NEW embeddings ✅
    [4] Score > 0.4 → MATCHES ✅
```

## Timeline of What Happens on Vercel

### STARTUP (Server Cold Start)
```
Time: T0
Event: Server starts
Action:
  1. initClassifier() runs
  2. loadEmbeddingsFromStorage()
     - Tries Blob first → SUCCESS
     - Sets: cachedEmbeddings = {...}
     - Sets: lastLoadTime = T0
  3. embeddings = cachedEmbeddings
  4. Ready to serve requests ✅

Cache Status: FRESH (age = 0s)
```

### CLASSIFICATION REQUEST (First 30 min)
```
Time: T0 + 5s
Event: classify endpoint called
Check:
  - Is embeddings empty? NO
  - Is cache fresh? YES (5s < 30min)
  - Use cached data ✅

No DB query, no reload
Response: 1-2 seconds ✅
```

### RECOMPUTATION REQUEST
```
Time: T0 + 600s (10 minutes in)
Event: /api/recompute called
Action:
  1. Compute new embeddings
  2. Save to Blob ✅ (vector file updated)
  3. invalidateCache() → cachedEmbeddings = null ✅
  4. reloadEmbeddings() ✅ NEW FIX
     - Calls loadEmbeddingsFromStorage()
     - Since cache is null, loads fresh from Blob
     - Updates embeddings variable ✅
     - Updates lastLoadTime = T0 + 600s

Cache Status: REFRESHED
```

### NEXT CLASSIFICATION REQUEST (After Recompute)
```
Time: T0 + 605s
Event: classify endpoint called (new example)
Check:
  - Is embeddings empty? NO (just reloaded)
  - Is cache fresh? YES (cache was just refreshed)
  - Use embeddings with NEW example ✅

Compare with new example
  - Found in database → MATCH ✅
  - Score > 0.4 → SUCCESS ✅

Response: Result returned (not GPT fallback) ✅
```

### AFTER 30 MINUTES (Cache Expiry)
```
Time: T0 + 1800s (30 minutes)
Event: Any endpoint called
Check:
  - Cache age = 1800s
  - Is 1800s > 30min (1800s)? YES, cache expired
  
Action:
  1. loadEmbeddingsFromStorage()
  2. Load fresh from Blob
  3. Update cachedEmbeddings
  4. Update lastLoadTime

Cache Status: REFRESHED AGAIN
```

## Code Changes Made

### In `src/embeddingService.js` (Line ~281)

**BEFORE:**
```javascript
if (!wasTimeout && !wasLimited) {
  await reloadEmbeddings();  // ← Load from DB into cache
  
  // Save to storage
  await saveEmbeddings(freshEmbeddings);
  invalidateCache();  // ← Only clears Layer 1!
  // Layer 2 (embeddings variable) is STALE
}
```

**AFTER:**
```javascript
if (!wasTimeout && !wasLimited) {
  // Save to storage
  await saveEmbeddings(freshEmbeddings);
  invalidateCache();  // ← Clears Layer 1
  
  // Force reload to update Layer 2 (embeddings variable)
  await reloadEmbeddings();  // ← NEW! Loads fresh from Blob
}
```

## Why This Matters

### Vector File GENERATION Timeline
| Event | Layer 1 Cache | Layer 2 Variable | Layer 3 Storage | Status |
|-------|---------------|-----------------|-----------------|--------|
| Server Start | FRESH | FRESH | Source | ✅ Ready |
| After 5s | FRESH | FRESH | Source | ✅ Using Cache |
| Recompute saves | INVALID | **STALE** ❌ | FRESH | ❌ Mismatch |
| (BEFORE FIX) | | | | |
| Next classify | INVALID | **STALE** ❌ | FRESH | ❌ Falls back to GPT |
| | | | | |
| Recompute saves | INVALID | FRESH ✅ | FRESH | ✅ Synced |
| (AFTER FIX) | | | | |
| Next classify | INVALID | FRESH ✅ | FRESH | ✅ Matches! |

### Storage Locations
- **Layer 1 (Cache)**: In-memory variable in blobService.js - FASTEST
- **Layer 2 (Classifier)**: In-memory variable in classifier.js - USED FOR CLASSIFICATION
- **Layer 3 (Blob)**: Vercel Blob storage `classifier-embeddings.json` - SOURCE OF TRUTH

## Testing the Fix

```bash
# 1. Add a new example
curl -X POST http://vercel-url/api/categories/4/examples \
  -H "Content-Type: application/json" \
  -d '{"example": "Help with payment issue", "category": "billing"}'

# 2. Recompute embeddings
curl -X POST http://vercel-url/api/recompute

# 3. Check response - should see:
# "Forcing embeddings reload after save..."

# 4. Classify with same text
curl -X POST http://vercel-url/api/classify \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Help with payment issue"}'

# 5. Verify result
# EXPECTED: { category: "billing", similarity: 0.92, matched: true }
# NOT: { category: "general", fallback: "gpt", reason: "no match" }
```

## Summary

**The Issue**: After recomputing embeddings, the vector file was updated in Blob storage, but the server's in-memory `embeddings` variable wasn't refreshed, so classifications used stale data and fell back to GPT.

**The Solution**: After `invalidateCache()`, call `reloadEmbeddings()` to load the fresh embeddings from Blob into the server's memory.

**Impact**: 
- ✅ New examples immediately available for classification
- ✅ No more unexpected GPT fallbacks
- ✅ Vector file always in sync with classification results
- ✅ Each layer stays synchronized

