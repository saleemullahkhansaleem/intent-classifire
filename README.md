# Intent Classifier

A full-stack application for classifying user intents into categories using AI embeddings with GPT fallback.

## Features

- **Intent Classification**: Classify prompts into categories (code, reasoning, image_generation, etc.)
- **Category Management**: Full CRUD for categories with per-category thresholds
- **Example Management**: Add, edit, delete training examples with bulk operations
- **Embedding Recomputation**: Regenerate embeddings for all examples
- **Consumption Tracking**: Monitor token usage and API costs
- **Bulk Testing**: Test multiple prompts at once

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (local) / Vercel Postgres (production)
- **AI**: OpenAI API (embeddings + GPT models)

## Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key

### Installation

```bash
# Install dependencies
npm install

# Create .env file
echo "OPENAI_API_KEY=your-api-key-here" > .env

# Initialize database and migrate data
node src/db/migrate.js --migrate-json

# Start development server
npm run dev
```

Visit http://localhost:3000

## Environment Variables

See [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md) for complete environment variable documentation.

**Required:**

- `OPENAI_API_KEY` - Your OpenAI API key

**Optional:**

- `EMBEDDING_MODEL` - Embedding model (default: `text-embedding-3-large`)
- `FALLBACK_MODEL` - GPT model for fallback (default: `gpt-4o-mini`)

## Deployment

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for Vercel deployment instructions.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System architecture and design
- [Environment Variables](./docs/ENVIRONMENT.md) - Environment configuration
- [Deployment](./docs/DEPLOYMENT.md) - Vercel deployment guide

## Project Structure

```
intent-classifire/
├── app/                    # Next.js app directory
│   ├── api/                # API routes
│   └── page.jsx            # Main page
├── components/             # React components
├── src/
│   ├── classifier.js      # Classification logic
│   ├── embeddingService.js # Embedding management
│   └── db/                 # Database layer
│       ├── database.js     # DB connection
│       ├── queries/        # Query utilities
│       └── migrations/     # Migration scripts
├── data/                   # Data files (SQLite DB, labels.json)
└── docs/                   # Documentation
```

## Usage

1. **Classification**: Enter prompts to classify them
2. **Bulk Test**: Paste multiple prompts (one per line) for bulk classification
3. **Manage**: Create categories, add examples, set thresholds, recompute embeddings

## License

MIT
