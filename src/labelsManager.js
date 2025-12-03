// src/labelsManager.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root directory (go up from src/)
const projectRoot = path.resolve(__dirname, "..");
const labelsPath = path.resolve(projectRoot, "data", "labels.json");

// Read labels from file
export function readLabels() {
  try {
    const data = fs.readFileSync(labelsPath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading labels:", err);
    throw new Error("Failed to read labels file");
  }
}

// Write labels to file
export function writeLabels(labels) {
  try {
    fs.writeFileSync(labelsPath, JSON.stringify(labels, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing labels:", err);
    throw new Error("Failed to write labels file");
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

