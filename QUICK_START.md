# Quick Reference

## Local Testing Commands

```bash
# Start dev server
npm run dev

# Test classification
curl -X POST http://localhost:3001/api/classify \
  -H "Content-Type: application/json" \
  -d '{"prompt": "I want to delete my account"}'

# Recompute embeddings (saves to local JSON)
curl -X POST http://localhost:3001/api/recompute

# Check status
curl http://localhost:3001/api/recompute/status

# Check embeddings
curl http://localhost:3001/api/health/embeddings
```

## Production Commands

```bash
# Deploy to Vercel
git push

# Recompute on Vercel (saves to Blob)
curl -X POST https://your-app.vercel.app/api/recompute

# Check Vercel logs
vercel logs --follow
```

## Environment Variables

```bash
# Development (local)
# No special variables needed
# Automatically saves to src/classifier_embeddings.json

# Production (Vercel)
BLOB_READ_WRITE_TOKEN=<your-token>
DATABASE_URL=<postgres-url>
OPENAI_API_KEY=sk-...
```

## Key Functions

**src/blobService.js:**
- `loadEmbeddingsFromStorage()` → Load from local or Blob
- `saveEmbeddings(embeddings)` → Save to local or Blob
- `invalidateCache()` → Clear in-memory cache
- `getCachedEmbeddings()` → Direct cache access

**src/classifier.js:**
- `initClassifier(options)` → Initialize system
- `classifyText(text)` → Classify a prompt
- Re-exports: `saveEmbeddings`, `invalidateCache`, `getCachedEmbeddings`

**src/embeddingService.js:**
- `recomputeEmbeddings()` → Compute & save embeddings

## Files

```
src/
├── blobService.js        ← Storage abstraction (dual mode)
├── classifier.js         ← Classification engine
├── embeddingService.js   ← Recomputation logic
└── classifier_embeddings.json  ← Local embeddings (created on save)

TESTING.md              ← Detailed testing guide
```

## How It Works

### Local Flow
```
npm run dev
  ↓
initClassifier()
  ↓
loadEmbeddingsFromStorage()
  ↓
Check src/classifier_embeddings.json
  ↓
Load & cache for 30 minutes
```

### Recomputation
```
POST /api/recompute
  ↓
recomputeEmbeddings()
  ↓
Compute missing embeddings
  ↓
saveEmbeddings()
  ↓
Write to src/classifier_embeddings.json (local)
  └─ OR Vercel Blob (production)
  ↓
invalidateCache()
  ↓
Next startup loads fresh
```

## Expected Logs

### Local Development
```
[EmbeddingStorage] Loading embeddings from local file...
[EmbeddingStorage] Loaded from local: X categories
[EmbeddingStorage] Using cached embeddings from local file
[EmbeddingStorage] Saving embeddings to local file...
[EmbeddingStorage] Saved to local file successfully
```

### Production (Vercel)
```
[EmbeddingStorage] Loading embeddings from Vercel Blob...
[EmbeddingStorage] Loaded from Blob: X categories
[EmbeddingStorage] Using cached embeddings from Blob
[EmbeddingStorage] Saving embeddings to Vercel Blob...
[EmbeddingStorage] Saved to Blob successfully
```

## Testing Checklist

- [ ] Local: npm run dev
- [ ] Local: POST /api/classify
- [ ] Local: POST /api/recompute
- [ ] Local: Check src/classifier_embeddings.json created
- [ ] Local: Restart server, verify loads from file
- [ ] Vercel: Set BLOB_READ_WRITE_TOKEN
- [ ] Vercel: Deploy
- [ ] Vercel: POST /api/recompute
- [ ] Vercel: Check logs for Blob success
- [ ] Vercel: POST /api/classify, verify ~1-2s response

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No embeddings found | Run `/api/recompute` first |
| Local file not updating | Check file permissions, restart server |
| Blob not working | Verify `BLOB_READ_WRITE_TOKEN` in Vercel |
| Classification slow | Check logs - might be using GPT fallback |
| Cache not updating | Recomutation should invalidate it |

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Local startup (cached) | <100ms | ✓ |
| Vercel startup (cached) | ~100ms | ✓ |
| Classification | 1-2s | ✓ |
| Recomputation | <45s | ✓ |

---

See **TESTING.md** for detailed guide.
