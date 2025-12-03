import 'dotenv/config';
import fs from "fs";
import path from "path";
import { getEmbedding } from "./embed.js";

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
