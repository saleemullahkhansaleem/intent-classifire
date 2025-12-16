# Intent Classifier

A minimal, high-performance intent classification system with embedding-based similarity matching and optional GPT fallback.

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (Coolify, Neon, Supabase, or Vercel Postgres)
- OpenAI API key

### Installation

```bash
# Install dependencies
npm install

# Create .env with database and API keys
echo "POSTGRES_URL=postgresql://..." >> .env.local
echo "OPENAI_API_KEY=sk-..." >> .env.local
echo "CLASSIFICATION_THRESHOLD=0.4" >> .env.local

# Start dev server
npm run dev
```

Visit `http://localhost:3000`

## Architecture

### Storage

- **Database**: PostgreSQL (categories, examples, embeddings, metadata)
- **Cache**: In-memory example embeddings (loaded at startup)

### Classification Flow

1. User sends prompt → Embed input text (fresh, not cached)
2. Compare with pre-computed example embeddings
3. If similarity ≥ threshold → Return local classification
4. If similarity < threshold → Call GPT fallback with cost logging

### Cost Optimization

- **Input embeddings**: $0.00013 per 1K tokens (OpenAI text-embedding-3-large)
- **Example embeddings**: $0.00013 per 1K tokens (only during recompute)
- **GPT fallback**: $0.15/1M input tokens, $0.6/1M output tokens

## API Reference

### Classification

```bash
# Single classification
curl -X POST http://localhost:3000/api/classify \
  -H "Content-Type: application/json" \
  -d '{"prompt": "help with billing"}'

# Response
{
  "results": [{
    "prompt": "help with billing",
    "label": "support",
    "score": 0.92,
    "source": "Local",
    "consumption": null
  }]
}
```

### Recompute Embeddings

```bash
# Generate embeddings for uncomputed examples
curl -X POST http://localhost:3000/api/recompute
```

Processes all uncomputed examples and stores embeddings in the database.

### Categories (CRUD)

```bash
# Get all categories
curl http://localhost:3000/api/categories

# Create category
curl -X POST http://localhost:3000/api/categories \
  -d '{"name":"billing","description":"Billing questions"}'

# Update category
curl -X PUT http://localhost:3000/api/categories/1 \
  -d '{"name":"billing","description":"Updated description"}'

# Delete category
curl -X DELETE http://localhost:3000/api/categories/1
```

### Examples (CRUD)

```bash
# Get examples for category
curl http://localhost:3000/api/categories/1/examples

# Add example
curl -X POST http://localhost:3000/api/categories/1/examples \
  -d '{"text":"How do I update my billing info?"}'

# Update example
curl -X PUT http://localhost:3000/api/categories/1/examples/5 \
  -d '{"text":"How do I change my card?"}'

# Delete example
curl -X DELETE http://localhost:3000/api/categories/1/examples/5
```

## Environment Variables

```env
# Required: PostgreSQL connection string
POSTGRES_URL=postgresql://user:pass@host:5432/dbname

# Required: OpenAI API key for embeddings and fallback
OPENAI_API_KEY=sk-proj-...

# Optional: Models to use
EMBEDDING_MODEL=text-embedding-3-large
FALLBACK_MODEL=gpt-4o-mini

# Optional: Classification threshold (0.0-1.0, default: 0.4)
# Used for all categories - similarity score must be >= this to use local classification
CLASSIFICATION_THRESHOLD=0.4
```

## Deployment

### Vercel

1. Set environment variables in Vercel project settings
2. Push to main branch
3. Vercel auto-deploys
4. Run recompute after deployment:
   ```bash
   curl -X POST https://your-app.vercel.app/api/recompute
   ```

### Other Platforms

Use any Node.js hosting with:
- PostgreSQL database access
- OpenAI API key access

## Performance

- **Classify**: ~100-150ms (embed + similarity matching)
- **Fallback**: ~1-2s additional (GPT API call)
- **Recompute**: ~1min for 100 examples (batch embedding generation)
- **Memory**: ~200MB for 1600 example embeddings

## Monitoring

Watch logs for cost tracking:

```
[GPT Fallback] Calling gpt-4o-mini model...
[GPT Fallback] Response received in 1.23s
[Classify] ⚠️ FALLBACK USED - Cost Breakdown:
  Embedding cost: $0.000038 (293 tokens @ $0.00013/1K)
  GPT cost: $0.000018
    - Input: $0.000013 (85 tokens @ $0.15/1M)
    - Output: $0.000005 (12 tokens @ $0.6/1M)
  Total cost: $0.000056
```

## Development

```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run start  # Start prod server
npm run lint   # Run linter
```

The app uses:
- Next.js 14 (React + API routes)
- PostgreSQL (via pg driver)
- OpenAI API (embeddings + GPT-4o-mini fallback)
- Tailwind CSS + Radix UI (components)
