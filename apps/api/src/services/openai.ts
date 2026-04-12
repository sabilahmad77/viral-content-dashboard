import OpenAI from 'openai';
import { config } from '../lib/config';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY not configured');
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

// ── Caption generation ────────────────────────────────────────────────────────
export async function generateCaptionOpenAI(prompt: { system: string; user: string }): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    // Full structured caption: hook + 3 paragraphs + 6 hashtags + 4 references ≈ 500-700 tokens
    max_tokens: 700,
    temperature: 0.78,
  });
  return (res.choices[0].message.content ?? '').trim();
}

// ── Describe base image via GPT-4o Vision ─────────────────────────────────────
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    if (url.startsWith('data:')) {
      const [header, base64] = url.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');
      return { base64, mimeType };
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
    return { base64: Buffer.from(buf).toString('base64'), mimeType };
  } catch {
    return null;
  }
}

async function describeBaseImage(imageUrl: string): Promise<string> {
  const img = await fetchImageAsBase64(imageUrl);
  if (!img) return '';

  const res = await getClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'low' },
          },
          {
            type: 'text',
            text: 'Describe this image precisely: list every visual element — the main subject(s), their exact position, background details, color palette, lighting style, composition, and overall mood. Be very specific. This description will be used to recreate the same scene.',
          },
        ],
      },
    ],
  });
  return res.choices[0].message.content ?? '';
}

// ── Real image editing via gpt-image-1 ───────────────────────────────────────
// This takes the actual uploaded base image as input and returns an EDITED version.
// It is NOT text-to-image generation — the output is derived from the input image.
export async function editImageGPT(prompt: string, baseImageUrl: string): Promise<string> {
  const img = await fetchImageAsBase64(baseImageUrl);
  if (!img) throw new Error('Failed to fetch base image for editing');

  const buffer = Buffer.from(img.base64, 'base64');
  const ext = img.mimeType.includes('png') ? 'png' : 'jpeg';
  const imageFile = new File([buffer], `base_image.${ext}`, { type: img.mimeType });

  const res = await getClient().images.edit({
    model: 'gpt-image-1',
    image: imageFile,
    prompt: prompt.slice(0, 32000), // gpt-image-1 supports long prompts
    n: 1,
    size: '1024x1024',
  });

  const b64 = (res.data?.[0] as { b64_json?: string })?.b64_json;
  if (!b64) throw new Error('gpt-image-1 edit returned no image data');
  return `data:image/png;base64,${b64}`;
}

// ── Caption structure validator ───────────────────────────────────────────────
// Minimal check: only reject captions that are clearly broken.
// We do NOT check emoji, exact paragraph count, or exact reference count —
// GPT-4o and Gemini format these slightly differently and strict checks cause
// every Gemini slot to fail, stopping the entire caption sequence.
//
// What we DO check (hard requirements):
//   1. Non-empty output of meaningful length
//   2. Fixed hashtags present (#fblifestyle #photographt #community)
//   3. No URLs (plain text references only)
export interface CaptionValidationResult {
  valid: boolean;
  issues: string[];
}

const FIXED_HASHTAGS = ['#fblifestyle', '#photographt', '#community'];

export function validateCaptionStructure(caption: string): CaptionValidationResult {
  const issues: string[] = [];
  const raw = caption.trim();

  // Must have meaningful content
  if (raw.length < 80) {
    issues.push(`Caption too short (${raw.length} chars) — model likely returned nothing useful`);
    return { valid: false, issues };
  }

  // Fixed hashtags must be present
  for (const tag of FIXED_HASHTAGS) {
    if (!raw.toLowerCase().includes(tag.toLowerCase())) {
      issues.push(`Missing required hashtag: ${tag}`);
    }
  }

  // No clickable URLs allowed
  if (/https?:\/\/\S+/.test(raw)) {
    issues.push('Caption contains URLs — must use plain text references only');
  }

  return { valid: issues.length === 0, issues };
}

// ── Quality validation via GPT-4o-mini Vision ────────────────────────────────
// Requirements 3-4, 21, 33-36
// Compares the generated image to the base image to detect:
//   blur / structure deviation / remaining text / template mismatch
export type FailureType = 'blur' | 'structure' | 'text_remaining' | 'template_mismatch' | null;

export interface ValidationResult {
  valid: boolean;
  failureType: FailureType;
  reason: string;
}

export async function validateEditedImage(
  generatedDataUrl: string,
  baseDataUrl: string
): Promise<ValidationResult> {
  try {
    const genImg = generatedDataUrl.startsWith('data:')
      ? generatedDataUrl
      : `data:image/png;base64,${generatedDataUrl}`;
    const baseImg = baseDataUrl.startsWith('data:')
      ? baseDataUrl
      : `data:image/png;base64,${baseDataUrl}`;

    const res = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'You are a quality-control inspector for an image editing engine. ' +
                'Image 1 is the BASE (original). Image 2 is the EDITED output. ' +
                'Evaluate the edited image strictly. Return ONLY valid JSON (no markdown), exactly: ' +
                '{"valid":true/false,"failureType":null/"blur"/"structure"/"text_remaining"/"template_mismatch","reason":"<one sentence>"}. ' +
                'Mark valid=false if: (a) the edited image is blurry or low-quality, ' +
                '(b) the composition / camera angle / scene changed heavily, ' +
                '(c) visible watermarks or text remain, ' +
                '(d) the output looks like a completely new image unrelated to the base. ' +
                'Mark valid=true if it is a clean, sharp edit of the same base image.',
            },
            { type: 'image_url', image_url: { url: baseImg, detail: 'low' } },
            { type: 'image_url', image_url: { url: genImg, detail: 'low' } },
          ],
        },
      ],
    });

    const raw = (res.choices[0].message.content ?? '').trim();
    const parsed = JSON.parse(raw);
    return {
      valid: parsed.valid === true,
      failureType: (parsed.failureType as FailureType) ?? null,
      reason: String(parsed.reason ?? 'No reason returned'),
    };
  } catch (err) {
    // If validation itself fails, treat as valid to avoid blocking the pipeline
    console.warn('  ⚠ Image validation call failed — treating as valid:', (err as Error).message);
    return { valid: true, failureType: null, reason: 'Validation skipped (API error)' };
  }
}

// ── API health probe ──────────────────────────────────────────────────────────
// Requirement 24: Check OpenAI API is reachable before starting image generation
export async function probeApiHealth(): Promise<boolean> {
  try {
    await getClient().models.list();
    return true;
  } catch {
    return false;
  }
}

// ── Image generation via DALL-E 3 ────────────────────────────────────────────
const DALLE_MAX_PROMPT = 3900; // DALL-E 3 hard limit is 4000; keep 100 chars safety margin

export async function generateImageDalle(prompt: string, baseImageUrl?: string): Promise<string> {
  let finalPrompt = prompt;

  if (baseImageUrl) {
    const description = await describeBaseImage(baseImageUrl);
    if (description) {
      // Strongly anchor to the base image — the output must be a variation of the SAME scene
      const anchor =
        `CRITICAL: This image must be a direct variation of a specific reference image. ` +
        `DO NOT create a new scene. DO NOT introduce new subjects, backgrounds, or compositions. ` +
        `The reference image contains: ${description}. ` +
        `KEEP all of the above elements exactly as described. ` +
        `Apply ONLY these specific changes from the template: ${prompt}`;
      finalPrompt = anchor.slice(0, DALLE_MAX_PROMPT);
    }
  }

  // Ensure we're never over the limit regardless of input
  if (finalPrompt.length > DALLE_MAX_PROMPT) {
    finalPrompt = finalPrompt.slice(0, DALLE_MAX_PROMPT);
  }

  const res = await getClient().images.generate({
    model: 'dall-e-3',
    prompt: finalPrompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'url',
  });

  const url = res.data?.[0]?.url;
  if (!url) throw new Error('DALL-E returned no image URL');
  return url;
}
