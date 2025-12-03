// src/labelsManager.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root directory (go up from src/)
const projectRoot = path.resolve(__dirname, "..");

// Helper function to find labels file using multiple path strategies
function findLabelsFile() {
  const possiblePaths = [
    // Standard path from project root
    path.resolve(projectRoot, "data", "labels.json"),
    // Path relative to current working directory (for Vercel)
    path.resolve(process.cwd(), "data", "labels.json"),
    // Path from __dirname (current file location)
    path.resolve(__dirname, "..", "data", "labels.json"),
    // Absolute path fallback for Vercel
    "/vercel/path0/data/labels.json",
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

// Read labels from file
export function readLabels() {
  const labelsPath = findLabelsFile();

  if (!labelsPath) {
    throw new Error(
      "Labels file not found. Please ensure data/labels.json exists in the project."
    );
  }

  try {
    const data = fs.readFileSync(labelsPath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading labels:", err);
    console.error("Attempted path:", labelsPath);
    throw new Error(`Failed to read labels file: ${err.message}`);
  }
}

// Write labels to file
export function writeLabels(labels) {
  const labelsPath = findLabelsFile();

  if (!labelsPath) {
    // If file doesn't exist, try to create it in the standard location
    const defaultPath = path.resolve(projectRoot, "data", "labels.json");
    try {
      // Ensure directory exists
      const dir = path.dirname(defaultPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        defaultPath,
        JSON.stringify(labels, null, 2),
        "utf-8"
      );
      return true;
    } catch (err) {
      console.error("Error writing labels:", err);
      throw new Error(`Failed to write labels file: ${err.message}`);
    }
  }

  try {
    fs.writeFileSync(labelsPath, JSON.stringify(labels, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing labels:", err);
    throw new Error(`Failed to write labels file: ${err.message}`);
  }
}

// Get all labels
export function getAllLabels() {
  return readLabels();
}

// Get label by name
export function getLabelByName(labelName) {
  const labels = readLabels();
  return labels.find((label) => label.name === labelName);
}

// Add example to label
export function addExampleToLabel(labelName, example) {
  if (!example || typeof example !== "string" || example.trim() === "") {
    throw new Error("Example must be a non-empty string");
  }

  const labels = readLabels();
  const labelIndex = labels.findIndex((label) => label.name === labelName);

  if (labelIndex === -1) {
    throw new Error(`Label "${labelName}" not found`);
  }

  if (!labels[labelIndex].examples) {
    labels[labelIndex].examples = [];
  }

  // Check if example already exists
  if (labels[labelIndex].examples.includes(example.trim())) {
    throw new Error("Example already exists");
  }

  labels[labelIndex].examples.push(example.trim());
  writeLabels(labels);

  return labels[labelIndex];
}

// Update example at index
export function updateExample(labelName, index, newExample) {
  if (!newExample || typeof newExample !== "string" || newExample.trim() === "") {
    throw new Error("Example must be a non-empty string");
  }

  const labels = readLabels();
  const labelIndex = labels.findIndex((label) => label.name === labelName);

  if (labelIndex === -1) {
    throw new Error(`Label "${labelName}" not found`);
  }

  if (!labels[labelIndex].examples || index < 0 || index >= labels[labelIndex].examples.length) {
    throw new Error("Invalid example index");
  }

  labels[labelIndex].examples[index] = newExample.trim();
  writeLabels(labels);

  return labels[labelIndex];
}

// Delete example at index
export function deleteExample(labelName, index) {
  const labels = readLabels();
  const labelIndex = labels.findIndex((label) => label.name === labelName);

  if (labelIndex === -1) {
    throw new Error(`Label "${labelName}" not found`);
  }

  if (!labels[labelIndex].examples || index < 0 || index >= labels[labelIndex].examples.length) {
    throw new Error("Invalid example index");
  }

  labels[labelIndex].examples.splice(index, 1);
  writeLabels(labels);

  return labels[labelIndex];
}

