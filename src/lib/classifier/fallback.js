/**
 * GPT Fallback Classifier
 * Used when local embedding score is below threshold.
 */

import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OpenAI;

export async function gptFallbackClassify(text, categories) {
    if (!categories || categories.length === 0) {
      console.error("[GPT Fallback] No categories found");
      return null;
    }

    const categoryList = categories.map((cat) => `- ${cat.name}`).join("\n");
    const prompt = `You are a classifier. Classify this request into one of these categories:
${categoryList}

Respond with JSON: { "label": "<category>", "confidence": 0.0-1.0 }

Request: "${text}"`;

    if (!OPENAI_API_KEY) {
        console.warn("[GPT Fallback] No OpenAI API Key available");
        return null;
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const model = process.env.FALLBACK_MODEL || "gpt-4o-mini";

    console.log(`[GPT Fallback] Calling ${model}...`);
    const startTime = Date.now();

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[GPT Fallback] Response in ${duration}s`);

      const content = response.choices?.[0]?.message?.content?.trim();
      if (!content) return null;

      try {
        // Try parsing JSON
        let parsed;
        if (content.startsWith("```json")) {
            parsed = JSON.parse(content.replace(/```json\n?|```/g, ""));
        } else {
            parsed = JSON.parse(content);
        }

        if (parsed.label && categories.some((c) => c.name === parsed.label)) {
          return {
            label: parsed.label,
            confidence: parsed.confidence ?? 0.5,
            tokens: response.usage || {},
          };
        }
      } catch (e) {
        // Fallback to simple string match if JSON parse fails
        const firstLine = content.split("\n")[0].trim();
        if (categories.some((c) => c.name === firstLine)) {
          return {
            label: firstLine,
            confidence: 0.5,
            tokens: response.usage || {},
          };
        }
      }
      return null;

    } catch (err) {
      console.error("[GPT Fallback] Error:", err.message);
      return null;
    }
}
