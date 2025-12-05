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

    // Classify all prompts
    const results = [];
    for (const p of inputPrompts) {
      // classifyText returns { prompt, label, score, source, consumption }
      const classification = await classifyText(p, OPENAI_API_KEY, {
        useGptFallback: true,
      });
      // Source is already set by classifyText ("Local" or "fallback")
      results.push(classification);
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

    res.json({
      message: "Example added successfully!",
      label: updatedLabel,
    });
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

    res.json({
      message: "Example updated successfully!",
      label: updatedLabel,
    });
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

    res.json({
      message: "Example deleted successfully!",
      label: updatedLabel,
    });
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
