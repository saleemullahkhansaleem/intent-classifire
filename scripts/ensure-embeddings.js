// scripts/ensure-embeddings.js
// Ensure classifier_embeddings.json exists before build
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const embeddingsPath = path.resolve(projectRoot, "src", "classifier_embeddings.json");

if (!fs.existsSync(embeddingsPath)) {
  console.warn("⚠️  classifier_embeddings.json not found at:", embeddingsPath);
  console.warn("⚠️  The file will be created on first API call via recompute-embeddings endpoint.");
  console.warn("⚠️  For production, ensure the file is committed to git or generated during build.");
  process.exit(0); // Don't fail build, just warn
} else {
  console.log("✓ classifier_embeddings.json found");
}

