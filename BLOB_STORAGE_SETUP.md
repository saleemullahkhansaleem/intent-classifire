# Vercel Blob Storage Setup

## Overview

This application now uses Vercel Blob Storage for persistent file storage in production. This allows CRUD operations to work in Vercel's serverless environment.

## Setup Instructions

### 1. Install Vercel Blob Storage

The package `@vercel/blob` has been added to `package.json`. Install it:

```bash
npm install
```

### 2. Get Blob Storage Token

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Storage**
3. Create a new Blob Store (if you don't have one)
4. Copy the **Blob Store Token** (it starts with `vercel_blob_rw_`)

### 3. Set Environment Variable

In your Vercel project settings:

1. Go to **Settings** → **Environment Variables**
2. Add a new variable:
   - **Name**: `BLOB_READ_WRITE_TOKEN`
   - **Value**: Your Blob Store Token (from step 2)
   - **Environments**: Production, Preview, Development (select all)

### 4. Deploy

After setting the environment variable, redeploy your application:

```bash
git push
```

Or trigger a redeploy from the Vercel dashboard.

## How It Works

### Storage Abstraction

The application uses a storage abstraction layer (`src/storage.js`) that:

- **In Development**: Uses the local file system (`data/labels.json`, `src/classifier_embeddings.json`)
- **In Production (Vercel)**: Uses Vercel Blob Storage when `BLOB_READ_WRITE_TOKEN` is set
- **Fallback**: Falls back to file system if Blob Storage is not available

### Files Stored in Blob Storage

- `labels.json` - Training examples for all labels
- `classifier_embeddings.json` - Precomputed embeddings for classification

### Automatic Detection

The code automatically detects:
- Vercel environment (`VERCEL === "1"` or `VERCEL_ENV`)
- Blob Storage token availability (`BLOB_READ_WRITE_TOKEN`)

## Benefits

✅ **Full CRUD in Production**: Add, edit, and delete examples through the UI
✅ **Persistent Storage**: Data persists across deployments
✅ **No Code Changes**: Works automatically when token is set
✅ **Development Friendly**: Still uses file system locally

## Troubleshooting

### Error: "File writes not supported"

This means `BLOB_READ_WRITE_TOKEN` is not set. Make sure:
1. The environment variable is set in Vercel
2. You've redeployed after setting it
3. The token is correct

### Error: "Blob not found"

On first deployment, the blob files don't exist yet. The system will:
1. Try to read from Blob Storage
2. Fall back to reading from the file system (git)
3. Create the blob on first write

### Local Development

In local development, the app uses the file system even if `BLOB_READ_WRITE_TOKEN` is set. This is intentional to keep development simple.

## Migration

If you already have data in `data/labels.json`:

1. The first time you add/edit an example in production, it will be saved to Blob Storage
2. Subsequent reads will use Blob Storage
3. The git file remains as a fallback

## Cost

Vercel Blob Storage pricing:
- Free tier: 1 GB storage, 1 GB bandwidth/month
- Pro: $0.15/GB storage, $0.40/GB bandwidth

For this use case (small JSON files), you'll likely stay within the free tier.

