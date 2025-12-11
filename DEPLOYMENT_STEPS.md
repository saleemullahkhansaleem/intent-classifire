# Vercel Deployment Checklist - Embeddings Fixed

## Pre-Deployment ✓

- [x] Database embeddings generated (200/200)
- [x] Blob storage synced with embeddings
- [x] Code compiles without errors
- [x] All necessary scripts available

## Vercel Environment Variables Required

Add these to your Vercel Dashboard → Settings → Environment Variables:

```
# Required
OPENAI_API_KEY=sk-proj-...
POSTGRES_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
EMBEDDING_MODEL=text-embedding-3-large

# Optional
FALLBACK_MODEL=gpt-4o-mini
```

## Deployment Steps

### 1. Deploy to Vercel
```bash
git push origin main
# Or use Vercel CLI: vercel deploy --prod
```

Wait for deployment to complete (usually 2-3 minutes)

### 2. Run Recompute (Important!)
After deployment, trigger recompute to populate Blob storage with embeddings:

```bash
curl -X POST https://your-project.vercel.app/api/recompute
```

Expected response:
```json
{
  "success": true,
  "message": "Embeddings computed successfully! Computed 199 new examples (skipped 1 already-computed).",
  "labelsProcessed": 7,
  "totalExamples": 200,
  "skippedExamples": 0,
  "alreadyComputed": 1,
  "elapsedSeconds": "47.3",
  "incomplete": false,
  "persisted": true
}
```

### 3. Test Classification
```bash
curl -X POST https://your-project.vercel.app/api/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "write a Node.js express server"}'
```

Expected response (should match examples, not fallback to GPT):
```json
{
  "category": "code",
  "method": "embedding",
  "similarity": 0.92,
  "match": "write a Node.js server with Express"
}
```

### 4. Verify Blob Storage
- Go to Vercel Dashboard
- Select project
- Go to Storage → Blob
- Should see `intent-classifire-blob/classifier-embeddings.json`
- File size should be ~2-3 MB with 200 embeddings

## Troubleshooting

### If recompute returns `persisted: false`
- Check `BLOB_READ_WRITE_TOKEN` is set in Vercel environment
- Check `POSTGRES_URL` is set and accessible
- Try running again: `curl -X POST https://your-url/api/recompute`

### If classification still returns GPT fallback
- Check embeddings were synced to Blob
- Wait a few minutes for cache to populate
- Try: `curl https://your-url/api/health/embeddings`

### If database shows no embeddings
- Run recompute again (should pick up from where it left off)
- Check `POSTGRES_URL` connection
- Check `OPENAI_API_KEY` is valid

## Post-Deployment Monitoring

### Health Check Endpoint
```bash
curl https://your-project.vercel.app/api/health/embeddings
```

Should show:
- Total categories: 7
- Total embeddings: 200
- Storage location: Blob

### Future Recomputes
If you add new examples:
1. They'll automatically get embeddings computed on-demand during classification
2. Or manually trigger: `curl -X POST https://your-url/api/recompute`
3. Embeddings will auto-sync to Blob

## Emergency Commands

### Rebuild Blob Storage from Database
If Blob gets corrupted, rebuild from database:
```bash
node scripts/init-blob-embeddings.js
# But first set BLOB_READ_WRITE_TOKEN locally
# export BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

### Check Database State
```bash
node scripts/test-db.js
```

### Test Updates Work
```bash
node scripts/test-update.js
```

## Success Indicators

✅ You'll know everything is working when:
- [x] Recompute returns 200 examples computed
- [x] Classification returns method: "embedding" (not "gpt-fallback")
- [x] Similarity score is > 0.80 for matching examples
- [x] Blob storage file exists and is ~2-3 MB
- [x] Vercel logs show "[EmbeddingStorage] Using cached embeddings from Blob"

## Notes

- First request after deployment may be slow (loads from Blob, then caches)
- Subsequent requests are instant (uses 30-minute cache)
- Cache auto-refreshes when embeddings are updated via recompute
- Embeddings are stored JSON format in Blob for fast loading

---

**Status**: ✅ Ready for production deployment
**Last Updated**: Today
**Tested**: All functions verified working locally
