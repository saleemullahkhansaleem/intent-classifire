# Environment Variables Setup Guide

## Overview

Your application needs environment variables in two places:
1. **Local Development** (`.env.local`)
2. **Vercel Production** (Vercel Project Settings)

---

## Current Status

### ✅ You Already Have
```
DATABASE_URL                    ← PostgreSQL connection
POSTGRES_URL                    ← Vercel Postgres format
POSTGRES_URL_NON_POOLING        ← Non-pooled version
+ Other POSTGRES_* variables
```

### ❌ You're Missing

| Variable | Where Needed | Purpose | Status |
|----------|-------------|---------|--------|
| `OPENAI_API_KEY` | Both | OpenAI embeddings API | ⚠️ REQUIRED |
| `BLOB_READ_WRITE_TOKEN` | Vercel only | Vercel Blob storage | ⚠️ RECOMMENDED |

---

## What Each Variable Does

### 1. OPENAI_API_KEY ⚠️ CRITICAL

**Purpose**: Compute embeddings for text classification using OpenAI's API

**Where to add**:
- `.env.local` (for local development)
- Vercel Project Settings (for production)

**How to get**:
1. Go to https://platform.openai.com/account/api-keys
2. Login with your OpenAI account (create if needed)
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Save it securely

**Format**:
```
OPENAI_API_KEY=sk-proj-your-actual-key-here...
```

**Cost**: ~$0.02 per 1,000 recomputed examples (using text-embedding-3-large)

---

### 2. BLOB_READ_WRITE_TOKEN 🚀 OPTIONAL BUT RECOMMENDED

**Purpose**: Store embeddings in Vercel Blob for faster loading (optional but highly recommended)

**Where to add**: Vercel Project Settings ONLY (not needed locally)

**How to get**:
1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Storage
4. Click "Create Database" → "Blob"
5. Create a new Blob store (name it "intent-classifier" or similar)
6. Once created, click "Generate Read/Write Token"
7. Copy the token

**Format**:
```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

**Benefits**:
- Embeddings cached in Blob storage (faster than database)
- Reduces database queries
- Improves performance (1-2s vs 3-5s per classification)

**If NOT set**:
- Falls back to database queries
- Still works, but slower
- App will log: "Running on Vercel without BLOB_READ_WRITE_TOKEN"

---

## Setup Instructions

### Step 1: Add OPENAI_API_KEY to .env.local

**Edit**: `.env.local`

Add this line at the end:
```bash
# OpenAI API for embeddings computation
OPENAI_API_KEY=sk-proj-your-actual-key-here...
```

**Full example** (your file should look like):
```bash
# Coolify PostgreSQL Database Configuration
DATABASE_URL=postgresql://postgres:E14afyb7YGlpFuoY00BYuUpymtRJH0qpe84sHsAlWxRQMuSKc4RmVKwVm244lWjG@84.46.243.252:3000/postgres
DATABASE_URL_UNPOOLED=postgresql://postgres:E14afyb7YGlpFuoY00BYuUpymtRJH0qpe84sHsAlWxRQMuSKc4RmVKwVm244lWjG@84.46.243.252:3000/postgres

# ... other POSTGRES variables ...

POSTGRES_PRISMA_URL=postgresql://postgres:E14afyb7YGlpFuoY00BYuUpymtRJH0qpe84sHsAlWxRQMuSKc4RmVKwVm244lWjG@84.46.243.252:3000/postgres?connect_timeout=15

# OpenAI API for embeddings computation
OPENAI_API_KEY=sk-proj-your-actual-key-here...
```

### Step 2: Test Locally

```bash
# Restart your dev server
npm run dev

# Try recompute endpoint
curl -X POST http://localhost:3000/api/recompute

# You should see logs like:
# [Recompute] Computing embeddings...
# NOT: "OPENAI_API_KEY is not set"
```

### Step 3: Set Up Vercel Environment Variables

**Go to**: https://vercel.com/dashboard

**Steps**:
1. Select your project: `intent-classifire`
2. Go to **Settings** tab
3. Click **Environment Variables** in sidebar
4. Add these variables:

#### Add OPENAI_API_KEY
- Name: `OPENAI_API_KEY`
- Value: `sk-proj-your-actual-key...`
- Environments: **Production, Preview, Development**
- Click **Add**

#### Add BLOB_READ_WRITE_TOKEN (Optional but Recommended)
- Name: `BLOB_READ_WRITE_TOKEN`
- Value: `vercel_blob_rw_...`
- Environments: **Production, Preview, Development**
- Click **Add**

**Visual Guide**:
```
Settings → Environment Variables
┌─────────────────────────────────────┐
│ Name: OPENAI_API_KEY                │
│ Value: sk-proj-...                  │
│ ✓ Production                         │
│ ✓ Preview                            │
│ ✓ Development                        │
│ [Add] [Delete]                       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Name: BLOB_READ_WRITE_TOKEN         │
│ Value: vercel_blob_rw_...           │
│ ✓ Production                         │
│ ✓ Preview                            │
│ ✓ Development                        │
│ [Add] [Delete]                       │
└─────────────────────────────────────┘
```

### Step 4: Redeploy

After adding environment variables to Vercel:

```bash
# Push a new commit to trigger redeploy
git add .env.local
git commit -m "Add OPENAI_API_KEY to local env"
git push origin main
```

Or manually redeploy:
1. Go to Vercel dashboard
2. Select your project
3. Click "Deployments" tab
4. Find the latest deployment
5. Click the "..." menu → **Redeploy**

---

## Verification Checklist

### Local Development
- [ ] OPENAI_API_KEY added to `.env.local`
- [ ] `npm run dev` starts without errors
- [ ] `/api/recompute` endpoint works
- [ ] Logs show: "Computing embeddings..." (not API key error)

### Vercel Production
- [ ] OPENAI_API_KEY added to Vercel env vars
- [ ] BLOB_READ_WRITE_TOKEN added (optional)
- [ ] Latest deployment completed successfully
- [ ] Logs show storage mode: "Blob (production)" or "Database fallback"

### Full Flow Test
```bash
# 1. Add example
curl -X POST https://your-vercel-url/api/categories/4/examples \
  -H "Content-Type: application/json" \
  -d '{"example": "Test example"}'

# 2. Recompute (should use OPENAI_API_KEY)
curl -X POST https://your-vercel-url/api/recompute

# 3. Classify (should find match)
curl -X POST https://your-vercel-url/api/classify \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test example"}'
```

---

## Summary of What You Need

### For Local Development (.env.local)
```bash
# Database (already have ✓)
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...

# OpenAI (ADD THIS ⚠️)
OPENAI_API_KEY=sk-proj-...
```

### For Vercel Production (Project Settings)
```
✓ DATABASE_URL or POSTGRES_URL (already set)
⚠️ OPENAI_API_KEY (MUST ADD)
🚀 BLOB_READ_WRITE_TOKEN (RECOMMENDED)
```

---

## Troubleshooting

### Error: "OPENAI_API_KEY is not set"
**Solution**: Add `OPENAI_API_KEY` to `.env.local` and/or Vercel env vars

### Error: "No such file or directory" when saving embeddings
**Cause**: BLOB_READ_WRITE_TOKEN not set on Vercel
**Solution**: 
- Option 1: Add `BLOB_READ_WRITE_TOKEN` to Vercel (recommended)
- Option 2: Embeddings will be stored in database (still works, slower)

### Error: "Invalid API key"
**Cause**: OPENAI_API_KEY is wrong or expired
**Solution**: 
1. Get a fresh key from https://platform.openai.com/account/api-keys
2. Update in `.env.local` and Vercel
3. Redeploy

### Logs show "Local (development)" on Vercel
**Cause**: Running on Vercel but BLOB_READ_WRITE_TOKEN not set
**Solution**: Add BLOB_READ_WRITE_TOKEN to Vercel env vars and redeploy

---

## Cost & Rate Limits

### OpenAI API
- **Model**: `text-embedding-3-large`
- **Cost**: $0.00013 per 1,000 tokens (very cheap!)
- **Pricing**: ~$0.02 per 1,000 recomputed examples
- **Rate Limit**: 5,000 requests per minute (plenty)
- **Monthly Free Trial**: $5 credit (covers ~250,000 embeddings)

### Vercel Blob (Optional)
- **Free Plan**: 100 GB included
- **Cost**: $0.50 per additional GB
- **Your usage**: < 1 MB per 10,000 embeddings (basically free)

---

## Quick Copy-Paste

### .env.local
```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

### Vercel Environment Variables
```
OPENAI_API_KEY: sk-proj-your-key-here
BLOB_READ_WRITE_TOKEN: vercel_blob_rw_... (optional)
```

---

## Next Steps

1. **Get OpenAI API key** from https://platform.openai.com/account/api-keys
2. **Add to .env.local**
3. **Test locally** with `npm run dev` and `/api/recompute`
4. **Add to Vercel** settings
5. **Redeploy** to Vercel
6. **Test** add example → recompute → classify flow

After this, your app will:
- ✅ Compute embeddings correctly
- ✅ Store them in Blob (if token set) or Database
- ✅ Use them for classification
- ✅ No more GPT fallbacks for matched examples!

