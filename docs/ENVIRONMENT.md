# Environment Variables

## Required

### `OPENAI_API_KEY`

Your OpenAI API key for embeddings and GPT fallback.

```env
OPENAI_API_KEY=sk-proj-your-api-key-here
```

## Optional

### Model Configuration

#### `EMBEDDING_MODEL`

OpenAI embedding model (default: `text-embedding-3-large`)

```env
EMBEDDING_MODEL=text-embedding-3-large
```

**Options:**

- `text-embedding-3-large` (default)
- `text-embedding-3-small`
- `text-embedding-ada-002`

#### `FALLBACK_MODEL`

GPT model for fallback classification (default: `gpt-4o-mini`)

```env
FALLBACK_MODEL=gpt-4o-mini
```

**Options:**

- `gpt-4o-mini` (default)
- `gpt-4o`
- `gpt-4-turbo`
- `gpt-3.5-turbo`

### Server Configuration

#### `PORT`

Port for Express server (default: `3001`, not used in Next.js/Vercel)

```env
PORT=3001
```

#### `NODE_ENV`

Node environment (default: `development`)

```env
NODE_ENV=production
```

## Production (Vercel)

### Database Variables (Auto-set)

When using Vercel Postgres, these are automatically set:

- `POSTGRES_URL` - PostgreSQL connection URL
- `POSTGRES_PRISMA_URL` - Prisma-compatible URL
- `POSTGRES_URL_NON_POOLING` - Non-pooling URL

**Do not manually set these** - Vercel sets them automatically.

### Vercel Auto-set Variables

These are automatically set by Vercel:

- `VERCEL` - Set to `"1"` on Vercel
- `VERCEL_ENV` - Environment name (`production`, `preview`, `development`)
- `VERCEL_URL` - Deployment URL

## Example .env File

### Local Development

```env
OPENAI_API_KEY=sk-proj-your-api-key-here
EMBEDDING_MODEL=text-embedding-3-large
FALLBACK_MODEL=gpt-4o-mini
PORT=3001
NODE_ENV=development
```

### Production (Vercel Dashboard)

Set in Vercel → Settings → Environment Variables:

```
OPENAI_API_KEY = sk-proj-your-api-key-here
EMBEDDING_MODEL = text-embedding-3-large (optional)
FALLBACK_MODEL = gpt-4o-mini (optional)
NODE_ENV = production (optional)
```

## Verification

After setting environment variables:

```bash
# Check if variables are loaded
node -e "require('dotenv').config(); console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set ✓' : 'Not set ✗')"
```

## Security

- ⚠️ Never commit `.env` file to git
- ⚠️ Never share API keys publicly
- ✅ Use Vercel environment variables for production
- ✅ Use different keys for development and production
