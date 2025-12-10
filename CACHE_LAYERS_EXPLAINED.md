# The 3-Layer Cache Problem & Solution (Visual)

## ❌ BEFORE THE FIX

```
┌────────────────────────────────────────────────────────────────────┐
│                        SERVER MEMORY                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  blobService.js (Layer 1)        classifier.js (Layer 2)         │
│  ┌───────────────────────┐       ┌────────────────────────────┐  │
│  │ cachedEmbeddings      │       │ let embeddings = {         │  │
│  │ {                     │       │   "billing": [{...}],      │  │
│  │   "billing": [...],   │◄──┐   │   "support": [{...}]       │  │
│  │   "support": [...]    │   │   │ }                          │  │
│  │ }                     │   │   └────────────────────────────┘  │
│  └───────────────────────┘   │                                   │
│                              └────── Both reference DB            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                                    ↑
                                    │
┌────────────────────────────────────────────────────────────────────┐
│                    VERCEL BLOB STORAGE (Layer 3)                  │
├────────────────────────────────────────────────────────────────────┤
│  classifier-embeddings.json (OLD)                                  │
│  {                                                                 │
│    "billing": [{id:1, vector:[...]}],  ← No new example yet      │
│    "support": [{id:2, vector:[...]}]                             │
│  }                                                                 │
└────────────────────────────────────────────────────────────────────┘


STEP 1: USER ADDS NEW EXAMPLE
────────────────────────────────

POST /api/categories/4/examples → Database updated ✅

┌──────────────────────────────────────────────────────────────────┐
│ PostgreSQL Database                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ categories table                                         │   │
│  │  - billing                                               │   │
│  │    - id:1 "...", embedding: [...]                       │   │
│  │    - id:2 "Help with billing!" NEW ✅ (no embedding)   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘


STEP 2: USER RUNS RECOMPUTE
────────────────────────────────

POST /api/recompute → Processes database, saves to Blob

Flow:
  [1] Fetch all examples from database
  [2] Compute embeddings for new ones (id:2)
  [3] Save to Blob:

┌────────────────────────────────────────────────────────────────────┐
│                    VERCEL BLOB STORAGE (Layer 3)                  │
├────────────────────────────────────────────────────────────────────┤
│  classifier-embeddings.json (UPDATED)                             │
│  {                                                                │
│    "billing": [                                                  │
│      {id:1, vector:[0.1, 0.2, ...]},                            │
│      {id:2, vector:[0.15, 0.25, ...]} ✅ NEW EXAMPLE WITH VEC   │
│    ],                                                             │
│    "support": [{id:2, vector:[...]}]                            │
│  }                                                                │
└────────────────────────────────────────────────────────────────────┘
             ↑
             │ Saved by: await saveEmbeddings(freshEmbeddings)
             │
  [4] invalidateCache() → Clear Layer 1
  
┌────────────────────────────────────────────────────────────────────┐
│                        SERVER MEMORY                               │
├────────────────────────────────────────────────────────────────────┤
│  blobService.js (Layer 1)                                          │
│  ┌───────────────────────┐                                         │
│  │ cachedEmbeddings      │                                         │
│  │ = null ✅             │  ← Cleared!                             │
│  └───────────────────────┘                                         │
│                                                                    │
│  ❌ BUT Layer 2 NOT updated:                                       │
│  classifier.js (Layer 2)                                           │
│  ┌────────────────────────────────┐                               │
│  │ let embeddings = {             │                               │
│  │   "billing": [                 │                               │
│  │     {id:1, ...} ← OLD!          │  ← STALE! Missing id:2      │
│  │   ],                            │                               │
│  │   "support": [{...}]           │                               │
│  │ }                              │                               │
│  └────────────────────────────────┘                               │
└────────────────────────────────────────────────────────────────────┘


STEP 3: USER CLASSIFIES WITH NEW EXAMPLE TEXT
───────────────────────────────────────────────

POST /api/classify { prompt: "Help with billing!" }

classifyText() logic:
  [1] Check: Is embeddings empty? NO (has Layer 2 data)
  [2] Skip reload - already have embeddings
  [3] Compare input with Layer 2 embeddings
      Input vector: [0.14, 0.26, ...]
      Layer 2 billing examples: [id:1 only] ← OLD!
      Comparison: No match (id:2 missing)
  [4] Score < 0.4
  [5] FALLBACK TO GPT ❌

Response: { category: "general", fallback: "gpt", reason: "no high match" }

═══════════════════════════════════════════════════════════════════


✅ AFTER THE FIX

Flow changes in STEP 2:

STEP 2: USER RUNS RECOMPUTE (FIXED)
────────────────────────────────────

[1] Fetch all examples from database
[2] Compute embeddings for new ones
[3] Save to Blob ✅
[4] invalidateCache() ✅
[5] await reloadEmbeddings() ← NEW! ✅

reloadEmbeddings() does:
  → Calls loadEmbeddingsFromStorage()
  → Since cache is null, loads fresh from Blob
  → Updates Layer 1: cachedEmbeddings = {...fresh...}
  → Updates Layer 2: embeddings = {...fresh...}

Result:

┌────────────────────────────────────────────────────────────────────┐
│                        SERVER MEMORY                               │
├────────────────────────────────────────────────────────────────────┤
│  blobService.js (Layer 1)                                          │
│  ┌───────────────────────┐                                         │
│  │ cachedEmbeddings      │                                         │
│  │ {                     │                                         │
│  │   "billing": [        │                                         │
│  │     {id:1, ...},      │                                         │
│  │     {id:2, ...} ✅    │  ← FRESH! Has new example              │
│  │   ],                  │                                         │
│  │   "support": [{...}]  │                                         │
│  │ } ✅ UPDATED          │                                         │
│  └───────────────────────┘                                         │
│                                                                    │
│  ✅ Layer 2 NOW updated:                                           │
│  classifier.js (Layer 2)                                           │
│  ┌────────────────────────────────┐                               │
│  │ let embeddings = {             │                               │
│  │   "billing": [                 │                               │
│  │     {id:1, ...},               │                               │
│  │     {id:2, ...} ✅ NEW!        │  ← FRESH! Has new example    │
│  │   ],                            │                               │
│  │   "support": [{...}]           │                               │
│  │ } ✅ SYNCED                     │                               │
│  └────────────────────────────────┘                               │
└────────────────────────────────────────────────────────────────────┘
             ↑
             │ All 3 layers synchronized!


STEP 3: USER CLASSIFIES WITH NEW EXAMPLE TEXT (AFTER FIX)
──────────────────────────────────────────────────────────

POST /api/classify { prompt: "Help with billing!" }

classifyText() logic:
  [1] Check: Is embeddings empty? NO
  [2] embeddings has fresh data (just reloaded)
  [3] Compare input with Layer 2 embeddings
      Input vector: [0.14, 0.26, ...]
      Layer 2 billing examples: [id:1, id:2] ← FRESH!
      Comparison: id:2 matches! ✅
  [4] Score: 0.92 > 0.4 ✅
  [5] RETURN MATCH

Response: { category: "billing", similarity: 0.92, matched: true } ✅

═══════════════════════════════════════════════════════════════════

## Summary Table

| Aspect | BEFORE FIX | AFTER FIX |
|--------|-----------|-----------|
| **After Recompute** | | |
| Layer 1 (Blob cache) | Cleared ✅ | Cleared then reloaded ✅ |
| Layer 2 (embeddings var) | **STALE** ❌ | **FRESH** ✅ |
| Layer 3 (Blob storage) | Updated ✅ | Updated ✅ |
| Sync status | ❌ OUT OF SYNC | ✅ IN SYNC |
| | | |
| **Next Classification** | | |
| Uses embeddings from | Layer 2 (stale) ❌ | Layer 2 (fresh) ✅ |
| New example found? | ❌ No | ✅ Yes |
| Result | GPT fallback ❌ | Matches category ✅ |

