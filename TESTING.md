# Testing & Deployment Guide

## 🚀 Local Testing (Development)

When running locally, embeddings are automatically saved to `src/classifier_embeddings.json`:

### 1. Start the dev server
```bash
npm run dev
```

### 2. Test classification (uses cached embeddings)
```bash
curl -X POST http://localhost:3001/api/classify \
  -H "Content-Type: application/json" \
  -d '{"prompt": "I want to delete my account"}'
```

### 3. Recompute embeddings (saves to local JSON)
```bash
curl -X POST http://localhost:3001/api/recompute
```

**What happens:**
- Computes missing embeddings from database
- Automatically saves to `src/classifier_embeddings.json`
- Next startup loads from this file
- Logs show: `[EmbeddingStorage] Saved to local file successfully`

---

## 🌐 Production Deployment (Vercel)

On Vercel, embeddings are automatically saved to Vercel Blob storage.

### 1. Set environment variables in Vercel
```
BLOB_READ_WRITE_TOKEN=<your-vercel-blob-token>
DATABASE_URL=<your-postgres-url>
OPENAI_API_KEY=<your-openai-key>
```

Get Blob token: https://vercel.com/docs/storage/vercel-blob

### 2. Deploy to Vercel
```bash
git push  # or use Vercel CLI
```

### 3. Recompute embeddings (saves to Blob)
```bash
curl https://your-vercel-app.vercel.app/api/recompute
```

**What happens:**
- Computes missing embeddings from database
- Automatically uploads to Vercel Blob storage
- Next deployment loads from Blob (~100ms)
- Logs show: `[EmbeddingStorage] Saved to Blob successfully`

---

## 📊 How Storage Works

### Local Development Flow:
```
Server Startup:
  └─ loadEmbeddingsFromStorage()
     └─ Checks: src/classifier_embeddings.json
     └─ Returns: Cached for 30 minutes

Recomputation:
  └─ Computes embeddings
  └─ Saves to src/classifier_embeddings.json
  └─ Invalidates cache
  └─ Next startup reloads fresh file

Classification:
  └─ Uses cached embeddings
  └─ ~1-2 seconds per request
```

### Production (Vercel) Flow:
```
Server Startup:
  └─ loadEmbeddingsFromStorage()
     └─ Checks: Vercel Blob storage
     └─ Returns: Cached for 30 minutes

Recomputation:
  └─ Computes embeddings
  └─ Uploads to Vercel Blob
  └─ Invalidates cache
  └─ Next startup reloads fresh from Blob

Classification:
  └─ Uses cached embeddings
  └─ ~1-2 seconds per request
```

---

## 🔄 Smart Fallback Chain

The system tries storage options in this order:

1. **Vercel Blob** (if `BLOB_READ_WRITE_TOKEN` set in production)
   - Fastest, persistent, shared across instances
2. **PostgreSQL Database** (if `DATABASE_URL` set)
   - Fresh data, always available
3. **Local JSON File** (`src/classifier_embeddings.json`)
   - Works without external services
4. **GPT Fallback** (if all above fail)
   - Works but slow (~5-7s per request)

---

## 📝 Local Testing Checklist

- [ ] Run `npm run dev`
- [ ] POST to `/api/classify` with test prompt
- [ ] Verify response in ~1-2 seconds
- [ ] POST to `/api/recompute` to compute embeddings
- [ ] Check that `src/classifier_embeddings.json` is updated
- [ ] Verify logs show storage messages
- [ ] Kill dev server, restart
- [ ] Verify embeddings load from file automatically

---

## ✅ Production Testing Checklist

- [ ] Set BLOB_READ_WRITE_TOKEN in Vercel environment
- [ ] Deploy to Vercel (`git push`)
- [ ] POST to `/api/recompute` on production URL
- [ ] Check Vercel logs for "Saved to Blob successfully"
- [ ] POST to `/api/classify` with test prompt
- [ ] Verify response in ~1-2 seconds
- [ ] Kill and restart deployment
- [ ] Verify embeddings load from Blob automatically
- [ ] Check Vercel logs for "[EmbeddingStorage] Loaded from Blob"

---

## 🐛 Debugging

### Check logs locally:
```bash
npm run dev
# Look for [EmbeddingStorage] messages
```

### Check Vercel logs:
```bash
vercel logs --follow
```

### Check if embeddings file was created:
```bash
ls -la src/classifier_embeddings.json
cat src/classifier_embeddings.json | head -50
```

### Test specific endpoints:
```bash
# Check recomputation status
curl http://localhost:3001/api/recompute/status

# Check health/embeddings
curl http://localhost:3001/api/health/embeddings
```

---

## 📦 What Gets Saved

The embeddings file format (both local and Blob):

```json
{
  "category_name": [
    {
      "text": "example text",
      "embedding": [0.123, -0.456, ...]
    },
    ...
  ],
  "another_category": [...]
}
```

---

## ⚡ Performance

| Stage | Time |
|-------|------|
| Local dev startup | <100ms (cached) or 3-5s (first time) |
| Vercel startup | ~100ms (Blob cached) or 3-5s (first time) |
| Classification | ~1-2 seconds (only OpenAI API call) |
| Recomputation | 45s timeout on Vercel Pro |

---

## 💡 Tips

1. **Local testing is exact mirror of production** - Both use same code paths
2. **Cache expires after 30 minutes** - Longer gaps reload fresh data
3. **Recomputation automatically saves** - No extra steps needed
4. **Fallback is always available** - Never crashes, always classifies
5. **Logs are your friend** - Check `[EmbeddingStorage]` prefix for storage operations

---

## 🚨 Troubleshooting

**Issue: "No embeddings found"**
- First run `/api/recompute` to create embeddings
- Check that database has categories and examples

**Issue: "Classification timing out"**
- Logs should show if using GPT fallback (slower)
- Verify embeddings were computed successfully

**Issue: "Local file not updating"**
- Check file permissions on `src/classifier_embeddings.json`
- Run `/api/recompute` to trigger save
- Restart dev server

**Issue: "Blob not working on Vercel"**
- Verify `BLOB_READ_WRITE_TOKEN` is set
- Check Vercel environment variables
- Look at Vercel logs for specific errors
- Fallback will use database

---

Ready to test! 🎉
