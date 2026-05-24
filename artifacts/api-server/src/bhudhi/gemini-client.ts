import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger.js";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

const globalForGemini = globalThis as unknown as { bhudhiGemini: GoogleGenAI | undefined };

function getGeminiClient(): GoogleGenAI {
  if (globalForGemini.bhudhiGemini) return globalForGemini.bhudhiGemini;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("GEMINI_API_KEY not set — Gemini validation calls will use fallbacks");
  }

  const client = new GoogleGenAI({ apiKey: apiKey ?? "placeholder" });

  if (process.env.NODE_ENV !== "production") {
    globalForGemini.bhudhiGemini = client;
  }

  return client;
}

function extractText(response: { text?: string }): string {
  return (response.text ?? "").trim();
}

/** Standard Gemini call — no search grounding. */
export async function callGemini(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const genAI = getGeminiClient();
    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 2000,
      },
    });
    return extractText(response);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "[Gemini] Call failed");
    throw err;
  }
}

/** Gemini with native Google Search grounding — market / competitor intelligence. */
export async function callGeminiWithSearch(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const genAI = getGeminiClient();
    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 2000,
        tools: [{ googleSearch: {} }],
      },
    });
    return extractText(response);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "[Gemini] Search call failed");
    throw err;
  }
}

export function geminiApiKeyConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
