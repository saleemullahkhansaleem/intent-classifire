import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API routes are handled directly in app/api, no proxy needed
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "."),
    };

    // Ensure JSON files are included in serverless functions
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    return config;
  },
  // Copy embeddings file to output during build
  async generateBuildId() {
    const embeddingsPath = path.resolve(__dirname, "src", "classifier_embeddings.json");
    if (!fs.existsSync(embeddingsPath)) {
      console.warn("⚠️  classifier_embeddings.json not found. Make sure to run precompute_embeddings.js or the recompute API endpoint.");
    }
    return null; // Use default build ID
  },
};

export default nextConfig;
