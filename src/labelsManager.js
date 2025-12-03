// src/labelsManager.js
// Uses storage abstraction that supports both file system and Vercel Blob Storage
import {
  readLabels as readLabelsFromStorage,
  writeLabels as writeLabelsToStorage,
} from "./storage.js";

// Read labels from storage (file system or Blob Storage)
export async function readLabels() {
  return await readLabelsFromStorage();
}

// Write labels to storage (file system or Blob Storage)
export async function writeLabels(labels) {
  return await writeLabelsToStorage(labels);
}

// Get all labels
export async function getAllLabels() {
  return await readLabels();
}

// Get label by name
export async function getLabelByName(labelName) {
  const labels = await readLabels();
  return labels.find((label) => label.name === labelName);
}

// Add example to label
export async function addExampleToLabel(labelName, example) {
  if (!example || typeof example !== "string" || example.trim() === "") {
    throw new Error("Example must be a non-empty string");
  }

  const labels = await readLabels();
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
  await writeLabels(labels);

  return labels[labelIndex];
}

// Update example at index
export async function updateExample(labelName, index, newExample) {
  if (
    !newExample ||
    typeof newExample !== "string" ||
    newExample.trim() === ""
  ) {
    throw new Error("Example must be a non-empty string");
  }

  const labels = await readLabels();
  const labelIndex = labels.findIndex((label) => label.name === labelName);

  if (labelIndex === -1) {
    throw new Error(`Label "${labelName}" not found`);
  }

  if (
    !labels[labelIndex].examples ||
    index < 0 ||
    index >= labels[labelIndex].examples.length
  ) {
    throw new Error("Invalid example index");
  }

  labels[labelIndex].examples[index] = newExample.trim();
  await writeLabels(labels);

  return labels[labelIndex];
}

// Delete example at index
export async function deleteExample(labelName, index) {
  const labels = await readLabels();
  const labelIndex = labels.findIndex((label) => label.name === labelName);

  if (labelIndex === -1) {
    throw new Error(`Label "${labelName}" not found`);
  }

  if (
    !labels[labelIndex].examples ||
    index < 0 ||
    index >= labels[labelIndex].examples.length
  ) {
    throw new Error("Invalid example index");
  }

  labels[labelIndex].examples.splice(index, 1);
  await writeLabels(labels);

  return labels[labelIndex];
}
