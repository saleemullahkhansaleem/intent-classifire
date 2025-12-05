# Deployment Guide - Vercel

## Prerequisites

- GitHub account
- Vercel account
- OpenAI API key
- Vercel Postgres (for production database)

## Step 1: Prepare Repository

1. Push your code to GitHub
2. Ensure `.env` is in `.gitignore` (already configured)

## Step 2: Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

## Step 3: Environment Variables

In Vercel project settings → **Environment Variables**, add:

### Required

```
OPENAI_API_KEY=sk-proj-your-api-key-here
```

### Optional

```
EMBEDDING_MODEL=text-embedding-3-large
FALLBACK_MODEL=gpt-4o-mini
NODE_ENV=production
```

## Step 4: Setup Vercel Postgres

1. In Vercel project, go to **Storage** tab
2. Click **"Create Database"** → Select **Postgres**
3. Choose a plan and create database
4. Vercel automatically adds `POSTGRES_URL` environment variable

## Step 5: Initialize Database

After first deployment, initialize the database:

### Option A: Via API Route (Recommended)

Create a one-time initialization endpoint or use the migration script:

```bash
# SSH into Vercel function or use Vercel CLI
vercel env pull .env.local
node src/db/migrate.js --migrate-json
```

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Pull environment variables
vercel env pull

# Run migration locally (will use production DB if POSTGRES_URL is set)
node src/db/migrate.js --migrate-json
```

## Step 6: Deploy

1. Click **"Deploy"** in Vercel dashboard
2. Wait for deployment to complete
3. Visit your deployed URL

## Post-Deployment

1. **Initialize Database**: Run migration to create tables and import data
2. **Recompute Embeddings**: Use the "Recompute Embeddings" button in the app
3. **Verify**: Test classification to ensure everything works

## Important Notes

### Database

- **Local**: Uses SQLite (`data/database.db`)
- **Production**: Uses Vercel Postgres (automatically detected)
- Database connection is handled automatically by `src/db/database.js`

### Embeddings

- Embeddings are stored in the database (`embeddings_cache` table)
- Recomputation can take time - use Vercel Pro for longer timeouts
- Consider running recomputation as a background job for large datasets

### File System

- Vercel has read-only filesystem in serverless functions
- All data must be stored in database (already configured)
- JSON files are only used for local development

## Troubleshooting

### Database Connection Issues

- Verify `POSTGRES_URL` is set in Vercel environment variables
- Check database is not paused in Vercel dashboard
- Ensure database connection string is correct

### Migration Issues

- Run migration script after deployment
- Check database tables exist: `categories`, `examples`, `embeddings_cache`
- Verify data was migrated from `labels.json`

### Timeout Issues

- Embedding recomputation can timeout on Hobby plan (10s limit)
- Upgrade to Pro plan for 60s timeout
- Consider splitting recomputation into smaller batches

## Monitoring

- Check Vercel function logs for errors
- Monitor database usage in Vercel dashboard
- Track API costs in OpenAI dashboard
