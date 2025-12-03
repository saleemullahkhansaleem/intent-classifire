// src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import {
  initClassifier,
  classifyText,
  reloadEmbeddings,
} from "./classifier.js";
import OpenAI from "openai";
import {
  getAllLabels,
  getLabelByName,
  addExampleToLabel,
  updateExample,
  deleteExample,
} from "./labelsManager.js";
import { recomputeEmbeddings } from "./embeddingService.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OpenAI;

// Initialize classifier (embeddings loaded + optional GPT fallback)
initClassifier({ openaiApiKey: OPENAI_API_KEY });

// Embedding function using OpenAI embeddings API
// Returns embedding with usage info
const getEmbedding = async (text) => {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const response = await client.embeddings.create({
    model: "text-embedding-3-large", // more accurate
    input: text,
  });

  return {
    embedding: response.data[0].embedding,
    usage: response.usage || { total_tokens: 0 },
  };
};

// Unified endpoint: supports single or multiple prompts
// Input: { "prompt": "text" } OR { "prompts": ["text1", "text2"] }
app.post("/classify", async (req, res) => {
  try {
    const { prompt, prompts } = req.body;

    let inputPrompts = [];

    if (prompt && typeof prompt === "string") {
      inputPrompts = [prompt];
    } else if (Array.isArray(prompts) && prompts.length > 0) {
      inputPrompts = prompts.filter(
        (p) => typeof p === "string" && p.trim() !== ""
      );
      if (inputPrompts.length === 0) {
        return res
          .status(400)
          .json({ error: "No valid string prompts in array" });
      }
    } else {
      return res
        .status(400)
        .json({ error: "Invalid input: provide 'prompt' or 'prompts' array" });
    }

    // Wrapper to pass embedding with usage info
    const getEmbeddingWrapper = async (text) => {
      const result = await getEmbedding(text);
      // Return in format expected by classifier
      return {
        embedding: result.embedding,
        usage: result.usage,
      };
    };

    // Classify all prompts
    const results = [];
    for (const p of inputPrompts) {
      // classifyText returns { prompt, label, score, consumption }
      const classification = await classifyText(getEmbeddingWrapper, p, {
        useGptFallback: true,
      });

      // Set source based on score
      const source = classification.score === 0.5 ? "gpt_fallback" : "local";

      results.push({ ...classification, source });
    }

    // Return single object if only one prompt
    if (inputPrompts.length === 1) {
      return res.json(results[0]);
    }

    // Return array for multiple prompts
    res.json({ results });
  } catch (err) {
    console.error("Classification error:", err);
    res
      .status(500)
      .json({ error: "Classification failed", details: err.message });
  }
});

// Get all labels
app.get("/api/labels", (req, res) => {
  try {
    const labels = getAllLabels();
    res.json(labels);
  } catch (err) {
    console.error("Error fetching labels:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch labels", details: err.message });
  }
});

// Get label by name
app.get("/api/labels/:labelName", (req, res) => {
  try {
    const { labelName } = req.params;
    const label = getLabelByName(labelName);
    if (!label) {
      return res.status(404).json({ error: `Label "${labelName}" not found` });
    }
    res.json(label);
  } catch (err) {
    console.error("Error fetching label:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch label", details: err.message });
  }
});

// Add example to label
app.post("/api/labels/:labelName/examples", async (req, res) => {
  try {
    const { labelName } = req.params;
    const { example } = req.body;

    if (!example) {
      return res.status(400).json({ error: "Example is required" });
    }

    const updatedLabel = addExampleToLabel(labelName, example);

    // Trigger recomputation
    try {
      await recomputeEmbeddings();
      res.json({
        message: "Example added and embeddings recomputed",
        label: updatedLabel,
      });
    } catch (recomputeErr) {
      console.error("Error recomputing embeddings:", recomputeErr);
      res.status(500).json({
        error: "Example added but embedding recomputation failed",
        details: recomputeErr.message,
        label: updatedLabel,
      });
    }
  } catch (err) {
    console.error("Error adding example:", err);
    res
      .status(400)
      .json({ error: "Failed to add example", details: err.message });
  }
});

// Update example at index
app.put("/api/labels/:labelName/examples/:index", async (req, res) => {
  try {
    const { labelName, index } = req.params;
    const { example } = req.body;

    if (!example) {
      return res.status(400).json({ error: "Example is required" });
    }

    const idx = parseInt(index, 10);
    if (isNaN(idx)) {
      return res.status(400).json({ error: "Invalid index" });
    }

    const updatedLabel = updateExample(labelName, idx, example);

    // Trigger recomputation
    try {
      await recomputeEmbeddings();
      res.json({
        message: "Example updated and embeddings recomputed",
        label: updatedLabel,
      });
    } catch (recomputeErr) {
      console.error("Error recomputing embeddings:", recomputeErr);
      res.status(500).json({
        error: "Example updated but embedding recomputation failed",
        details: recomputeErr.message,
        label: updatedLabel,
      });
    }
  } catch (err) {
    console.error("Error updating example:", err);
    res
      .status(400)
      .json({ error: "Failed to update example", details: err.message });
  }
});

// Delete example at index
app.delete("/api/labels/:labelName/examples/:index", async (req, res) => {
  try {
    const { labelName, index } = req.params;
    const idx = parseInt(index, 10);

    if (isNaN(idx)) {
      return res.status(400).json({ error: "Invalid index" });
    }

    const updatedLabel = deleteExample(labelName, idx);

    // Trigger recomputation
    try {
      await recomputeEmbeddings();
      res.json({
        message: "Example deleted and embeddings recomputed",
        label: updatedLabel,
      });
    } catch (recomputeErr) {
      console.error("Error recomputing embeddings:", recomputeErr);
      res.status(500).json({
        error: "Example deleted but embedding recomputation failed",
        details: recomputeErr.message,
        label: updatedLabel,
      });
    }
  } catch (err) {
    console.error("Error deleting example:", err);
    res
      .status(400)
      .json({ error: "Failed to delete example", details: err.message });
  }
});

// Trigger embedding recomputation manually
app.post("/api/recompute-embeddings", async (req, res) => {
  try {
    const result = await recomputeEmbeddings();
    res.json(result);
  } catch (err) {
    console.error("Error recomputing embeddings:", err);
    res
      .status(500)
      .json({ error: "Failed to recompute embeddings", details: err.message });
  }
});

// Only start server if not in serverless environment
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export app for Vercel serverless functions
export default app;
