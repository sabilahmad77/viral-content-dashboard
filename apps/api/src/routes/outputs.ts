import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../middleware/auth';
import { uploadToR2, uploadUrlToR2, getSignedDownloadUrl, keyFromUrl } from '../services/storage';
import {
  generateCaptionOpenAI,
  editImageGPT,
  validateCaptionStructure,
} from '../services/openai';
import { generateCaptionGemini, generateImageGemini, GeminiImageUnavailableError } from '../services/gemini';
// addCircularOverlay removed — circle is preserved by the AI edit prompt, not added programmatically
import { config } from '../lib/config';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

function parseJsonField(val: unknown): unknown {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return {}; }
  }
  return val ?? {};
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ── Guarantee fixed brand hashtags are present in every caption ───────────────
const FIXED_HASHTAGS = ['#fblifestyle', '#photographt', '#community'];

function injectFixedHashtags(text: string): string {
  const lower = text.toLowerCase();
  if (FIXED_HASHTAGS.every(tag => lower.includes(tag))) return text;

  const lines = text.split('\n');
  const idx = lines.findIndex(line => (line.match(/#\w+/g) ?? []).length >= 2);

  if (idx !== -1) {
    const existing = (lines[idx].match(/#\w+/g) ?? [])
      .filter(tag => !FIXED_HASHTAGS.some(f => f.toLowerCase() === tag.toLowerCase()));
    const topicTags = existing.slice(0, 3);
    lines[idx] = [...FIXED_HASHTAGS, ...topicTags].join(' ');
    return lines.join('\n');
  }

  const filled = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.trim());
  if (filled.length > 4) {
    lines.splice(filled[filled.length - 4].i, 0, FIXED_HASHTAGS.join(' '), '');
  } else {
    lines.push('', FIXED_HASHTAGS.join(' '));
  }
  return lines.join('\n');
}

// Upload a data: URL (base64) or external URL to R2 if configured
async function resolveOutputUrl(
  url: string, jobId: string, slotId: string, regenVersion: number, ext: string, mimeType: string
): Promise<string> {
  if (!config.r2BucketName || !config.r2PublicUrl) return url;
  const key = `outputs/${jobId}/${slotId}/v${regenVersion}/${uuidv4()}.${ext}`;
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    return uploadToR2(buffer, key, mimeType);
  }
  if (!url.startsWith(config.r2PublicUrl)) {
    return uploadUrlToR2(url, key, mimeType);
  }
  return url;
}

// ── 10 distinct visual variations (mirrors jobWorker) ────────────────────────
// IMPORTANT: Variations are LIGHTING ONLY.
// Explicit clothing color instructions cause the AI to redesign the entire outfit.
// Lighting naturally affects perceived color — that is the only acceptable change.
const IMAGE_VARIATIONS: string[] = [
  'LIGHTING ONLY: Apply cool morning blue-tinted daylight — shift the entire scene to a cool, crisp blue atmosphere.',
  'LIGHTING ONLY: Apply dramatic overcast grey — shift scene to muted, stormy, desaturated tones.',
  'LIGHTING ONLY: Apply warm golden-hour lighting — bathe the entire scene in amber and orange glow.',
  'LIGHTING ONLY: Apply strong directional side-key light from the left — creates natural shadows across the scene.',
  'LIGHTING ONLY: Apply clean, even, soft front-fill daylight — eliminate harsh shadows, bright and clear.',
  'LIGHTING ONLY: Apply bright warm outdoor sunlight from slightly above — natural warmth, sunlit highlights.',
  'LIGHTING ONLY: Apply cool formal indoor lighting — controlled, blue-white, professional temperature.',
  'LIGHTING ONLY: Apply dramatic low uplight from below — shadows cast dramatically upward.',
  'LIGHTING ONLY: Apply soft warm overhead diffuse light — gentle, warm, ceiling-lit quality.',
  'LIGHTING ONLY: Apply crisp sharp cool-temperature daylight — high clarity, cool tones, sharp detail.',
];

// Append variation + preservation rules to the template (template stays primary).
// regenOffset shifts the variation index on each Recreate so you never get the same result twice.
function appendSlotVariation(templatePrompt: string, slotIndex: number, hasBaseImage: boolean, regenOffset = 0): string {
  if (!hasBaseImage) return templatePrompt;
  const variationIdx = (slotIndex + regenOffset) % IMAGE_VARIATIONS.length;
  const variation = IMAGE_VARIATIONS[variationIdx];
  return (
    templatePrompt +
    `\n\n================================================================================\n` +
    `SLOT VARIATION #${variationIdx + 1} — LIGHTING ONLY\n` +
    `================================================================================\n` +
    `Apply ONLY this lighting change to differentiate this slot from others:\n` +
    `${variation}\n\n` +
    `================================================================================\n` +
    `SUBJECT PRESERVATION — NON-NEGOTIABLE (apply before anything else)\n` +
    `================================================================================\n` +
    `1. FACE IDENTITY: The main subject's face must be 100% preserved — same person, same face\n` +
    `   structure, same features. Do NOT alter, remodel, or reimagine the face in any way.\n` +
    `2. FACE DIRECTION: A tiny turn is allowed (maximum ±5 degrees). No more than that.\n` +
    `3. CLOTHING: The style, cut, design, and color of all clothing must remain IDENTICAL to the\n` +
    `   original. Do NOT recolor, redesign, or replace any garment. The lighting change above will\n` +
    `   naturally affect how colors appear — that is the ONLY acceptable clothing change.\n` +
    `4. BODY & POSE: The subject's body shape, posture, and positioning must match the original exactly.\n` +
    `5. NO REIMAGINING: Do not creatively reimagine, redesign, or significantly alter the subject.\n\n` +
    `================================================================================\n` +
    `BACKGROUND RULE — KEEP LOCATION, SHIFT TONES ONLY\n` +
    `================================================================================\n` +
    `Keep the original background location and scene exactly. Only shift its lighting and color tones\n` +
    `per the variation above. NEVER replace with a plain solid color (no white/black/grey backdrop).\n\n` +
    `================================================================================\n` +
    `CIRCLE RULE — ONE CIRCLE ONLY\n` +
    `================================================================================\n` +
    `The base image has a circular portrait overlay (white-bordered circle, top-left, showing a face).\n` +
    `Preserve it EXACTLY — same position, same size, same white border, same face inside.\n` +
    `Do NOT add a second circle. Output must have EXACTLY ONE circle.`
  );
}

// ── Resolve the live prompt for this slot ─────────────────────────────────────
type SlotInfo = { slotType: string; modelUsed: string | null; promptSnapshot: unknown; slotIndex?: number };

// regenOffset: pass regenCount here so each Recreate picks a different variation index.
// On initial generation regenOffset=0, on first Recreate regenOffset=1, etc.
async function resolveLivePrompt(
  slot: SlotInfo,
  baseImageUrl: string | null,
  regenOffset = 0
): Promise<{ system?: string; user?: string; prompt?: string; model: string }> {
  const snap = parseJsonField(slot.promptSnapshot) as Record<string, unknown>;
  const model = slot.modelUsed ?? '';
  const slotIdx = slot.slotIndex ?? 0;
  const hasBase = !!baseImageUrl;

  const template = await db.promptTemplate.findFirst({ where: { isActive: true } });

  if (template) {
    const contentTxt = ((template.contentInstructions as string) ?? '').trim();
    const imageTxt = ((template.imageInstructions as string) ?? '').trim();

    if (slot.slotType === 'caption' && contentTxt) {
      const captionNumber = slotIdx + 1;
      const uniquenessNote = `\n\nThis is caption #${captionNumber}. It MUST be completely unique — a different opening hook, different emotional angle, different paragraph structure, different tone. Do NOT repeat any phrases or ideas from other captions in this batch.`;
      const baseUser = String(snap.user ?? 'Generate a caption following the provided instructions exactly.');
      return { model, system: contentTxt, user: `Caption #${captionNumber}. ${baseUser}${uniquenessNote}` };
    }

    if (slot.slotType === 'image' && imageTxt) {
      // regenOffset shifts variation index on each Recreate → different result every time
      return { model, prompt: appendSlotVariation(imageTxt, slotIdx, hasBase, regenOffset) };
    }

    if (slot.slotType === 'image' && hasBase) {
      return { model, prompt: appendSlotVariation('Refine and enhance the image quality.', slotIdx, true, regenOffset) };
    }
  }

  return {
    model,
    system: String(snap.system ?? ''),
    user: String(snap.user ?? ''),
    prompt: String(snap.prompt ?? ''),
  };
}

// ── Core regen AI call ────────────────────────────────────────────────────────
// Mirrors jobWorker.processSlot exactly:
//  - captions: uses live contentInstructions system prompt
//  - images + base image: uses editImageGPT (gpt-image-1 edit, NOT DALL-E generate)
//  - images + no base image: text-to-image fallback
//  - validation + circular overlay applied to images
async function callAI(
  slot: SlotInfo,
  baseImageUrl: string | null,
  jobId: string,
  slotId: string,
  regenVersion: number
): Promise<{ outputText?: string; outputUrl?: string }> {
  // Pass regenVersion as offset so each Recreate uses a different variation → different result
  const resolved = await resolveLivePrompt(slot, baseImageUrl, regenVersion);
  const model = resolved.model;

  // ── CAPTION ──────────────────────────────────────────────────────────────────
  if (slot.slotType === 'caption') {
    const system = resolved.system ?? '';
    const user = resolved.user ?? '';
    const raw = model === 'gemini'
      ? await generateCaptionGemini({ system, user })
      : await generateCaptionOpenAI({ system, user });

    // Inject fixed hashtags if the model omitted them (Gemini often does)
    const text = injectFixedHashtags(raw);

    // Validate caption structure
    const capValidation = validateCaptionStructure(text);
    if (!capValidation.valid) {
      throw new Error(`Caption structure failed: ${capValidation.issues.join('; ')}`);
    }
    return { outputText: text };
  }

  // ── IMAGE ─────────────────────────────────────────────────────────────────────
  if (slot.slotType === 'image') {
    const prompt = resolved.prompt ?? '';
    let url: string;

    if (baseImageUrl) {
      // Req 1-2, 21-22: Real image editing — NOT text-to-image.
      // Recreate always restarts from the original baseImageUrl stored on the job.
      console.log(`  🖼 [regen ${slotId}] Editing base image via gpt-image-1 (model=${model})`);

      if (model === 'gemini-imagen') {
        try {
          url = await generateImageGemini(prompt, baseImageUrl);
        } catch (err) {
          if (err instanceof GeminiImageUnavailableError) {
            console.log(`  ↳ Gemini unavailable, falling back to gpt-image-1 edit`);
            url = await editImageGPT(prompt, baseImageUrl);
          } else { throw err; }
        }
      } else {
        // openai-dalle → gpt-image-1 edit (never DALL-E 3 generate)
        url = await editImageGPT(prompt, baseImageUrl);
      }

      // Persist data URL to R2 if configured
      url = await resolveOutputUrl(url, jobId, slotId, regenVersion, 'png', 'image/png');
      // No programmatic circle added — the AI edit prompt (RULE 1) preserves the existing circle.

    } else {
      // No base image — standard Gemini / DALL-E text-to-image
      if (model === 'gemini-imagen') {
        try {
          url = await generateImageGemini(prompt, undefined);
        } catch (err) {
          if (err instanceof GeminiImageUnavailableError) {
            const { generateImageDalle } = await import('../services/openai');
            url = await generateImageDalle(prompt);
          } else { throw err; }
        }
      } else {
        const { generateImageDalle } = await import('../services/openai');
        url = await generateImageDalle(prompt);
      }
      url = await resolveOutputUrl(url, jobId, slotId, regenVersion, 'jpg', 'image/jpeg');
    }

    return { outputUrl: url };
  }

  throw new Error(`Unsupported slot type for regen: ${slot.slotType}`);
}

// ── POST /api/jobs/:jobId/slots/:slotId/regen ─────────────────────────────────
router.post(
  '/jobs/:jobId/slots/:slotId/regen',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const slot = await db.outputSlot.findUnique({
        where: { id: req.params.slotId },
        include: { job: { select: { userId: true, baseImageUrl: true } } },
      });

      if (!slot) { res.status(404).json({ error: 'Slot not found' }); return; }
      if (slot.jobId !== req.params.jobId) { res.status(400).json({ error: 'Slot does not belong to this job' }); return; }
      if (slot.job.userId !== req.user!.userId && req.user!.role !== 'SUPER_ADMIN') {
        res.status(403).json({ error: 'Forbidden' }); return;
      }

      // Archive previous output in history
      const prevHistory = Array.isArray(parseJsonField(slot.regenHistory))
        ? (parseJsonField(slot.regenHistory) as unknown[])
        : [];
      const historyEntry: Record<string, unknown> = {
        regenCount: slot.regenCount,
        timestamp: new Date().toISOString(),
      };
      if (slot.outputText) historyEntry.outputText = slot.outputText;
      if (slot.outputUrl) historyEntry.outputUrl = slot.outputUrl;

      const newRegenCount = slot.regenCount + 1;
      await db.outputSlot.update({
        where: { id: slot.id },
        data: {
          status: 'PROCESSING',
          regenCount: newRegenCount,
          regenHistory: JSON.stringify([...prevHistory, historyEntry]),
        },
      });

      // Respond immediately — process async in background
      res.json({ message: 'Regeneration started', slotId: slot.id });

      // Req 23-27: Retry up to 4 times with exponential backoff (8s for images)
      ;(async () => {
        const isImage = slot.slotType === 'image';
        const maxAttempts = isImage ? 4 : 3;
        const baseDelay = isImage ? 8000 : 3000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            // Req 28: 3-minute hard timeout per attempt
            const result = await Promise.race([
              callAI(slot, slot.job.baseImageUrl, slot.jobId, slot.id, newRegenCount),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Regen attempt timed out after 3 minutes')), 3 * 60 * 1000)
              ),
            ]);

            await db.outputSlot.update({
              where: { id: slot.id },
              data: { status: 'DONE', outputText: result.outputText, outputUrl: result.outputUrl },
            });
            console.log(`  ✅ [regen ${slot.id}] Completed on attempt ${attempt}`);
            return;
          } catch (err) {
            const msg = (err as Error).message;
            console.error(`  ✗ [regen ${slot.id}] Attempt ${attempt}/${maxAttempts} failed: ${msg}`);
            if (attempt < maxAttempts) {
              const delay = baseDelay * attempt;
              console.log(`    Retrying in ${delay / 1000}s...`);
              await sleep(delay);
            }
          }
        }

        // Req 27: All attempts exhausted — mark FAILED clearly
        await db.outputSlot.update({
          where: { id: slot.id },
          data: { status: 'FAILED' },
        });
        console.error(`  ✗ [regen ${slot.id}] All ${maxAttempts} attempts failed — slot marked FAILED`);
      })();

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── GET /api/outputs/:slotId/download ─────────────────────────────────────────
router.get('/outputs/:slotId/download', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const slot = await db.outputSlot.findUnique({
      where: { id: req.params.slotId },
      include: { job: { select: { userId: true } } },
    });

    if (!slot) { res.status(404).json({ error: 'Slot not found' }); return; }
    if (slot.job.userId !== req.user!.userId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    if (!slot.outputUrl) { res.status(400).json({ error: 'No output available' }); return; }

    // If no R2 or not an R2 URL, return directly (data URLs, external URLs)
    if (!config.r2BucketName || !config.r2PublicUrl || !slot.outputUrl.startsWith(config.r2PublicUrl)) {
      res.json({ url: slot.outputUrl, expiresIn: 3600 });
      return;
    }

    const key = keyFromUrl(slot.outputUrl);
    const signedUrl = await getSignedDownloadUrl(key);
    res.json({ url: signedUrl, expiresIn: 900 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
