# Palvoro Intent Classifire

A full-stack application for classifying user intents with example management and automatic embedding recomputation.

## Features

- **Intent Classification**: Classify user prompts into categories (code, low_effort, reasoning, image_generation, image_edit, web_surfing, ppt_generation)
- **Example Management**: Add, edit, and delete training examples through a web interface
- **Automatic Embedding Recomputation**: Embeddings are automatically recomputed when examples are modified
- **Consumption Tracking**: Track token usage and API costs for each classification
- **Modern UI**: Built with Next.js and Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Express.js, Node.js
- **AI**: OpenAI API (embeddings and GPT-4o-mini)

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3001
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   This will start:
   - Next.js frontend on http://localhost:3000
   - Express backend on http://localhost:3001

### Development

- **Frontend**: `npm run dev` - Starts Next.js dev server
- **Backend only**: `npm run server` - Starts Express server only

## Project Structure

```
intent-classifire/
├── app/                    # Next.js app directory
│   ├── api/                # Next.js API routes
│   ├── layout.jsx          # Root layout
│   ├── page.jsx            # Main page
│   └── globals.css         # Global styles
├── components/             # React components
│   ├── ClassificationForm.jsx
│   ├── ResultDisplay.jsx
│   ├── ConsumptionMetrics.jsx
│   ├── ExampleManager.jsx
│   ├── LabelCard.jsx
│   ├── ExampleList.jsx
│   ├── ExampleEditor.jsx
│   └── RecomputeStatus.jsx
├── src/                    # Backend source
│   ├── server.js          # Express server
│   ├── classifier.js      # Classification logic
│   ├── labelsManager.js    # Label/example management
│   ├── embeddingService.js # Embedding recomputation
│   └── precompute_embeddings.js
├── data/
│   └── labels.json         # Training examples
└── vercel.json            # Vercel configuration
```

## API Endpoints

### Classification
- `POST /classify` - Classify a prompt
  - Body: `{ "prompt": "text" }` or `{ "prompts": ["text1", "text2"] }`
  - Returns: `{ prompt, label, score, source, consumption }`

### Labels Management
- `GET /api/labels` - Get all labels
- `GET /api/labels/:labelName` - Get specific label
- `POST /api/labels/:labelName/examples` - Add example
- `PUT /api/labels/:labelName/examples/:index` - Update example
- `DELETE /api/labels/:labelName/examples/:index` - Delete example
- `POST /api/recompute-embeddings` - Manually trigger recomputation

## Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Set environment variables in Vercel dashboard:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `NODE_ENV`: `production`
4. Deploy

### Important Notes for Vercel

- File system writes are ephemeral in serverless functions. For production, consider using:
  - Vercel Blob Storage for `labels.json`
  - Database for persistent storage
- Embedding recomputation can be time-consuming. Consider:
  - Using background jobs
  - Implementing async processing with status polling
  - Using Vercel's longer timeout limits for Pro plans

## Usage

1. **Classification Tab**: Enter a prompt and see the classification result with consumption metrics
2. **Manage Examples Tab**:
   - View examples for each label category
   - Add new examples
   - Edit existing examples
   - Delete examples
   - Manually trigger embedding recomputation

## Token Costs

- Embeddings (text-embedding-3-large): ~$0.00013 per 1K tokens
- GPT-4o-mini: ~$0.15/$0.60 per 1M input/output tokens

Costs are calculated and displayed for each classification request.

