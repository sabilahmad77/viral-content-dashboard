import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../lib/config';

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!client) {
    if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
    client = new GoogleGenerativeAI(config.geminiApiKey);
  }
  return client;
}

// ── Fetch base image as inline data for Gemini ────────────────────────────────
async function fetchImageForGemini(url: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  try {
    if (url.startsWith('data:')) {
      const [header, data] = url.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');
      return { inlineData: { mimeType, data } };
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
    return { inlineData: { mimeType, data: Buffer.from(buf).toString('base64') } };
  } catch {
    return null;
  }
}

// ── Caption generation via Gemini Flash ──────────────────────────────────────
export async function generateCaptionGemini(prompt: { system: string; user: string }): Promise<string> {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: prompt.system,
    generationConfig: {
      maxOutputTokens: 800,
      temperature: 0.78,
    },
  });

  const result = await model.generateContent(prompt.user);
  const text = result.response.text().trim();
  if (!text) throw new Error('Gemini returned empty caption');
  return text;
}

// ── Image generation via Gemini imagen preview ────────────────────────────────
// Returns: data:mimeType;base64,... string
// Throws GeminiImageUnavailableError when the model is not accessible (404/403)
// so the caller can fall back gracefully to DALL-E 3.
export class GeminiImageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiImageUnavailableError';
  }
}

export async function generateImageGemini(prompt: string, baseImageUrl?: string): Promise<string> {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (baseImageUrl) {
    const imgPart = await fetchImageForGemini(baseImageUrl);
    if (imgPart) {
      parts.push(imgPart);
      parts.push({
        text:
          `Generate ONE single standalone image. ` +
          `CRITICAL RULES: ` +
          `(1) This output must be a direct variation of the provided base image — do NOT create a new scene. ` +
          `(2) Keep ALL subjects, people, objects, background, and overall composition identical to the base image. ` +
          `(3) Do NOT introduce any new visual elements that are not in the base image. ` +
          `(4) Do NOT output a collage, grid, or multiple panels — exactly ONE image. ` +
          `(5) Apply ONLY these specific template-defined changes to the base image: ${prompt}`,
      });
    } else {
      parts.push({
        text: `Generate ONE single standalone image (not a collage, not a grid, not multiple panels). ${prompt}`,
      });
    }
  } else {
    parts.push({ text: prompt });
  }

  // Model: gemini-2.5-flash-preview-05-20 — best available Gemini image generation model.
  // NOTE: "Nano Banana Pro" is not a real Gemini model ID. The model below is the
  // highest-quality Gemini image model available via the Generative Language API.
  // When Google releases a new model, update the ID here.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${config.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['image', 'text'] },
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    // 404 means the model endpoint is not available for this API key/region
    // 403 means the feature is not enabled on this account
    // Throw a special error so the worker can fall back to DALL-E 3
    if (res.status === 404 || res.status === 403) {
      throw new GeminiImageUnavailableError(
        `Gemini imagen model unavailable (${res.status}). Will fall back to DALL-E 3.`
      );
    }
    throw new Error(`Gemini image generation failed (${res.status}): ${errText}`);
  }

  const data = await res.json() as {
    candidates: Array<{
      content: { parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> };
    }>;
  };

  const responseParts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = responseParts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData) {
    throw new GeminiImageUnavailableError('Gemini returned no image data — model may not support image generation for this key');
  }

  const { mimeType, data: b64 } = imagePart.inlineData;
  return `data:${mimeType};base64,${b64}`;
}
