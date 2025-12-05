import "dotenv/config";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.Openai;

async function getEmbedding(text) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });
  return response.data[0].embedding;
}

const labelsPath = path.resolve("./data/labels.json");
const labels = JSON.parse(fs.readFileSync(labelsPath, "utf-8"));

async function precompute() {
  const embeddings = {};

  for (const label of labels) {
    embeddings[label.name] = [];
    for (const example of label.examples) {
      const vector = await getEmbedding(example);
      embeddings[label.name].push({ example, vector });
    }
  }

  fs.writeFileSync(
    "./src/classifier_embeddings.json",
    JSON.stringify(embeddings, null, 2)
  );
  console.log("Embeddings precomputed!");
}

precompute();
