# Architecture

## Overview

Intent Classifier uses AI embeddings for local classification with GPT fallback for low-confidence cases. All data is stored in a database (SQLite locally, Vercel Postgres in production).

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (local) / Vercel Postgres (production)
- **AI**: OpenAI API (embeddings + GPT models)

## System Components

### Database Layer

**Location**: `src/db/`

- `database.js` - Database connection (auto-detects SQLite/Postgres)
- `queries/` - Query utilities for categories, examples, embeddings
- `migrations/` - Database migration scripts

**Schema:**

- `categories` - Category definitions with thresholds
- `examples` - Training examples
- `embeddings_cache` - Cached embeddings
- `settings` - Global settings

### Classification Engine

**Location**: `src/classifier.js`

**Flow:**

1. Load embeddings from database
2. Compute embedding for input text
3. Compare with local embeddings (cosine similarity)
4. If score >= threshold → return local classification
5. If score < threshold → use GPT fallback

**Key Functions:**

- `initClassifier()` - Initialize embeddings and OpenAI client
- `classifyText()` - Main classification function
- `classifyEmbedding()` - Local embedding comparison
- `gptFallbackClassifier()` - GPT-based fallback

### Embedding Service

**Location**: `src/embeddingService.js`

- `recomputeEmbeddings()` - Regenerate embeddings for all examples
- Stores embeddings in database
- Tracks token consumption and costs

### API Routes

**Location**: `app/api/`

**Categories:**

- `GET/POST /api/categories` - List/create categories
- `GET/PUT/DELETE /api/categories/:id` - Category operations
- `PUT /api/categories/:id/threshold` - Update threshold

**Examples:**

- `POST /api/categories/:id/examples` - Add example
- `PUT/DELETE /api/categories/:id/examples/:exampleId` - Update/delete
- `POST/DELETE /api/categories/:id/examples/bulk` - Bulk operations

**Classification:**

- `POST /api/classify` - Single/multiple classification
- `POST /api/classify/bulk` - Bulk classification

**Recomputation:**

- `POST /api/recompute` - Trigger embedding recomputation

## Data Flow

### Classification Flow

```
User Input → API Route → classifyText()
  ↓
Compute Embedding (OpenAI)
  ↓
Compare with Local Embeddings
  ↓
Score >= Threshold? → Yes → Return Local Result
  ↓ No
GPT Fallback → Return Fallback Result
```

### Embedding Recomputation Flow

```
User Clicks "Recompute" → API Route → recomputeEmbeddings()
  ↓
Load Categories from Database
  ↓
For each Category:
  Load Examples
  For each Example:
    Generate Embedding (OpenAI)
    Store in Database
  ↓
Return Consumption Metrics
```

## Database

### Local Development

- Uses SQLite (`data/database.db`)
- File-based, no setup required
- Fast and easy for development

### Production

- Uses Vercel Postgres
- Automatically detected via `POSTGRES_URL`
- Managed by Vercel

## Consumption Tracking

**Tracked for:**

- Embedding generation (during recomputation)
- GPT fallback queries (when score < threshold)

**Not tracked for:**

- Local classifications (score >= threshold)

**Cost Calculation:**

- Embeddings: $0.00013 per 1K tokens
- GPT-4o-mini: $0.15/$0.60 per 1M input/output tokens

## Configuration

**Environment Variables:**

- `OPENAI_API_KEY` - Required
- `EMBEDDING_MODEL` - Optional (default: text-embedding-3-large)
- `FALLBACK_MODEL` - Optional (default: gpt-4o-mini)

**Per-Category Thresholds:**

- Stored in database (`categories.threshold`)
- Default: 0.4
- Editable via UI

## Frontend

**Main Components:**

- `CategoryManager` - Category and example management
- `ClassificationForm` - Single classification input
- `BulkTest` - Bulk classification testing
- `ConsumptionMetrics` - Display token usage and costs

**State Management:**

- React hooks (useState, useEffect)
- API calls via fetch
- Toast notifications for feedback
