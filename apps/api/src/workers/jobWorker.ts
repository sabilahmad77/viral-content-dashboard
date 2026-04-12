import db from '../lib/db';
import { jobQueue } from '../lib/queue';
import { generateCaptionOpenAI, generateImageDalle, editImageGPT, probeApiHealth, validateCaptionStructure } from '../services/openai';
import { generateCaptionGemini, generateImageGemini, GeminiImageUnavailableError } from '../services/gemini';
import { generateVideoKling } from '../services/kling';
import { uploadUrlToR2, uploadToR2 } from '../services/storage';
import { hashPrompt, getCached, setCached } from '../lib/cache';
import { buildCaptionSystemPrompt, buildImagePrompt } from '../routes/templates';
// imageComposite removed — circular overlays are preserved by the AI editing the base image,
// not added programmatically. Adding a programmatic circle on top of an image that already
// has a circle from the original causes a double-circle bug.
import { config } from '../lib/config';
import { v4 as uuidv4 } from 'uuid';

type SlotRow = Awaited<ReturnType<typeof db.outputSlot.findUnique>>;

type StoredSnapshot = {
  type: 'caption' | 'image' | 'video';
  model: string;
  label?: string;
  index?: number;
};

// The fully resolved prompt used at generation time
type ResolvedPrompt = {
  type: string;
  model: string;
  label: string;
  system?: string;
  user?: string;
  prompt?: string;
};

function parseJson(val: unknown): unknown {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return {}; }
  }
  return val;
}

function parseJsonObj(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* ignore */ }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Guarantee fixed brand hashtags are present in every caption ───────────────
// Gemini models sometimes omit the hashtag section despite instructions.
// This injects the 3 fixed hashtags before validation runs, so no caption
// ever fails purely because the model forgot to include them.
const FIXED_HASHTAGS = ['#fblifestyle', '#photographt', '#community'];

function injectFixedHashtags(text: string): string {
  const lower = text.toLowerCase();
  // All 3 already present — nothing to do
  if (FIXED_HASHTAGS.every(tag => lower.includes(tag))) return text;

  const lines = text.split('\n');

  // Find the hashtag line: a line that contains 2 or more #tags
  const idx = lines.findIndex(line => (line.match(/#\w+/g) ?? []).length >= 2);

  if (idx !== -1) {
    // Keep topic-specific hashtags the model provided, ensure fixed ones come first
    const existing = (lines[idx].match(/#\w+/g) ?? [])
      .filter(tag => !FIXED_HASHTAGS.some(f => f.toLowerCase() === tag.toLowerCase()));
    const topicTags = existing.slice(0, 3);
    lines[idx] = [...FIXED_HASHTAGS, ...topicTags].join(' ');
    return lines.join('\n');
  }

  // No hashtag line found at all — insert one before the last 4 non-empty lines (references)
  const filled = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.trim());
  if (filled.length > 4) {
    const insertAt = filled[filled.length - 4].i;
    lines.splice(insertAt, 0, FIXED_HASHTAGS.join(' '), '');
  } else {
    lines.push('', FIXED_HASHTAGS.join(' '));
  }
  return lines.join('\n');
}

async function handleDataUrl(dataUrl: string, jobId: string, slotId: string, ext: string, mimeType: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  if (!config.r2BucketName || !config.r2PublicUrl) return dataUrl;
  const base64 = dataUrl.split(',')[1];
  const buffer = Buffer.from(base64, 'base64');
  const key = `outputs/${jobId}/${slotId}/v0/${uuidv4()}.${ext}`;
  return uploadToR2(buffer, key, mimeType);
}

// ── 10 distinct visual variations for image uniqueness ───────────────────────
// Each image slot in a batch gets its own variation so that generating 10 images
// from the same base produces clearly different outputs (50%+ visually different).
// Extend this array if more slots are ever added.
const IMAGE_VARIATIONS: string[] = [
  'Bright natural morning daylight. Cool blue-tinted background atmosphere. Subject wearing deep navy blue.',
  'Dramatic overcast dramatic lighting. Stormy grey cloud-toned background. Subject wearing dark charcoal grey.',
  'Warm golden-hour sunset lighting. Amber and orange tinted background glow. Subject wearing warm brown or khaki.',
  'Sharp professional studio lighting. Very dark almost-black background. Subject in formal black attire.',
  'Clean soft diffused daylight. Neutral off-white or light grey background. Subject in mid-grey clothing.',
  'Slightly left-facing subject angle. Sunlit outdoor location. Background with olive and forest green tones.',
  'Slightly right-facing subject angle. Indoor formal setting background. Subject in steel blue or slate clothing.',
  'Low dramatic light from below. Dark dramatic nearly-black background. Midnight navy or dark indigo clothing.',
  'Soft overhead diffused light. Warm cream and beige background palette. Caramel or tan brown clothing.',
  'Cool crisp outdoor light. Green foliage or trees visible in background. Forest green or army green clothing.',
];

function getImageVariation(slotIndex: number): string {
  return IMAGE_VARIATIONS[slotIndex % IMAGE_VARIATIONS.length];
}

// ── Append variation + circle rule to the EXISTING template ──────────────────
// The admin template is the primary instruction. We only append a short addendum:
//   1. Per-slot variation (for uniqueness across 10+ images)
//   2. Circle rule (don't double-circle, preserve the original one)
// This keeps the template fully in control — nothing is overridden.
function appendSlotVariation(templatePrompt: string, slotIndex: number, hasBaseImage: boolean): string {
  if (!hasBaseImage) return templatePrompt;
  const variation = getImageVariation(slotIndex);
  return (
    templatePrompt +
    `\n\n================================================================================\n` +
    `SLOT VARIATION #${slotIndex + 1} OF 10 — APPLY FOR UNIQUENESS\n` +
    `================================================================================\n` +
    `For this specific slot, apply this visual style to differentiate it from other slots:\n` +
    `${variation}\n\n` +
    `CIRCLE RULE (CRITICAL): The base image already has a circular portrait overlay (white-bordered\n` +
    `circle, top-left corner, showing a person's face). You MUST preserve this circle EXACTLY as-is —\n` +
    `same position, same white border, same face inside. Do NOT add a second circle on top of it.\n` +
    `The output must have EXACTLY ONE circle — the original one from the base image.`
  );
}

// ── Build an EDIT-mode image prompt when a base image is present ─────────────
// Rules enforced on every edit regardless of template content:
//   1. PRESERVE the circular portrait overlay (top-left circle with person inside) EXACTLY
//   2. REMOVE all text, logos, watermarks, Anonymous mask logo, any overlay text
//   3. Keep the main subject's face direction nearly identical (±5 degrees max)
//   4. Keep clothing style identical; only the COLOR may shift slightly per variation
//   5. Change the background noticeably but keep it contextually relevant
//   6. Return exactly ONE image — no collages, panels, grids, or double exposures
//   7. Apply the variation style for this slot to ensure uniqueness
function wrapWithEditInstruction(slotPrompt: string, hasBaseImage: boolean, slotIndex = 0): string {
  if (!hasBaseImage) return slotPrompt;
  const variation = getImageVariation(slotIndex);
  return (
    `Edit the uploaded base image following these rules in strict order:\n\n` +

    `RULE 1 — PRESERVE CIRCULAR PORTRAIT: The base image has a circular portrait overlay ` +
    `(a person's photo inside a white-bordered circle, positioned top-left). ` +
    `Keep this circle EXACTLY as it appears — same position, same size, same white border, same person inside. ` +
    `Do NOT remove it, move it, resize it, or replace it. Do NOT add a second circle. ` +
    `There must be EXACTLY ONE circle in the output.\n\n` +

    `RULE 2 — REMOVE ALL TEXT AND LOGOS: Remove every text element, headline, caption, ` +
    `Anonymous mask logo, watermark, banner, or overlay that was in the original. ` +
    `The output image must be completely clean of text and logos.\n\n` +

    `RULE 3 — PRESERVE MAIN SUBJECT: Keep the main foreground subject (person, figure) ` +
    `with the same face, same face direction (within ±5 degrees), same body position. ` +
    `Do NOT change the person's identity, face structure, or expression significantly.\n\n` +

    `RULE 4 — CLOTHING COLOR VARIATION: Keep the same style and type of clothing. ` +
    `Apply this variation's color scheme: ${variation}\n\n` +

    `RULE 5 — BACKGROUND CHANGE: Change the background noticeably but keep it relevant ` +
    `to the original context. The new background must feel authentic and realistic.\n\n` +

    `RULE 6 — SINGLE IMAGE OUTPUT: Output exactly ONE image. No collages, no panels, ` +
    `no grids, no double exposures, no side-by-side comparisons.\n\n` +

    `Additional instructions: ${slotPrompt}`
  );
}

// ── Re-read the active template and build the live prompt for this slot ──────
// Called before EVERY slot generation (and before every retry) so template
// changes take effect immediately — the JSON is the single source of truth.
async function resolveSlotPrompt(
  slot: NonNullable<SlotRow>,
  newsInput: string,
  baseImageUrl: string | null
): Promise<ResolvedPrompt> {
  const snap = parseJson(slot.promptSnapshot) as StoredSnapshot;
  const label = snap.label ?? '';
  const hasBaseImage = !!baseImageUrl;

  // Fetch the CURRENT active template — not the version frozen at job creation
  const template = await db.promptTemplate.findFirst({ where: { isActive: true } });

  if (template) {
    // ── TXT instruction fields take full priority over JSON ──────────────────
    // These are set by the admin via the Content Template / Image Template editors.
    // When set, they are used verbatim — no fallback, no appending.
    const contentTxt = (template.contentInstructions as string ?? '').trim();
    const imageTxt = (template.imageInstructions as string ?? '').trim();
    const videoTxt = (template.videoInstructions as string ?? '').trim();

    if (slot.slotType === 'caption' && contentTxt) {
      const captionNumber = (snap.index !== undefined ? snap.index : slot.slotIndex ?? 0) + 1;
      const uniquenessNote = `\n\nThis is caption #${captionNumber} of 10. It MUST be completely unique — a different opening hook, different emotional angle, different paragraph structure, different tone from every other caption. Do NOT repeat any phrases, sentences, or ideas from other captions in this batch.`;
      const user = newsInput.trim()
        ? `Caption #${captionNumber} of 10. Topic/Content: ${newsInput}${uniquenessNote}`
        : `Caption #${captionNumber} of 10. Generate a caption following the provided instructions exactly.${uniquenessNote}`;
      return { type: 'caption', model: snap.model, label, system: contentTxt, user };
    }

    if (slot.slotType === 'image' && imageTxt) {
      // The admin template is the PRIMARY instruction — use it verbatim as the base.
      // Only append the per-slot variation + circle rule so the template stays in control.
      const slotIdx = snap.index !== undefined ? Number(snap.index) : (slot.slotIndex ?? 0);
      const prompt = appendSlotVariation(imageTxt, slotIdx, hasBaseImage);
      return { type: 'image', model: snap.model, label, prompt };
    }

    if (slot.slotType === 'video' && videoTxt) {
      const prompt = newsInput.trim() ? `${videoTxt}\n\nTopic/context: ${newsInput}` : videoTxt;
      return { type: 'video', model: snap.model, label, prompt };
    }

    // ── Image slot with base image but no TXT instruction set ───────────────
    if (slot.slotType === 'image' && hasBaseImage) {
      const slotIdx = snap.index !== undefined ? Number(snap.index) : (slot.slotIndex ?? 0);
      const prompt = wrapWithEditInstruction('Refine and enhance the image quality.', true, slotIdx); // wrapWithEditInstruction used only when NO template
      return { type: 'image', model: snap.model, label, prompt };
    }

    // ── Legacy JSON fallback for captions (when TXT contentInstructions not set) ──
    const captionJson = parseJsonObj(template.captionPromptJson);
    const hasCaptionJson = Object.keys(captionJson).length > 0;
    if (slot.slotType === 'caption' && hasCaptionJson) {
      const system = buildCaptionSystemPrompt(captionJson, label);
      const user = newsInput.trim()
        ? `Topic/Content: ${newsInput}`
        : 'Generate a caption following the provided rules exactly.';
      return { type: 'caption', model: snap.model, label, system, user };
    }
  }

  // No active template → fall back to the snapshot stored at job creation
  const fallback = parseJson(slot.promptSnapshot) as Omit<ResolvedPrompt, 'type' | 'model' | 'label'>;
  if (slot.slotType === 'image' && hasBaseImage) {
    const slotIdx = snap.index !== undefined ? Number(snap.index) : (slot.slotIndex ?? 0);
    const prompt = wrapWithEditInstruction('Refine and enhance the image quality.', true, slotIdx);
    return { type: snap.type, model: snap.model, label, ...fallback, prompt };
  }
  return { type: snap.type, model: snap.model, label, ...fallback };
}

// ── Core slot processor ──────────────────────────────────────────────────────
async function processSlot(
  slot: NonNullable<SlotRow>,
  baseImageUrl: string | null,
  resolved: ResolvedPrompt
): Promise<void> {
  const cacheKey = hashPrompt({ resolved, baseImageUrl });
  const cached = await getCached<{ outputText?: string; outputUrl?: string }>(cacheKey);

  if (cached) {
    await db.outputSlot.update({
      where: { id: slot.id },
      data: { status: 'DONE', outputText: cached.outputText, outputUrl: cached.outputUrl },
    });
    return;
  }

  await db.outputSlot.update({ where: { id: slot.id }, data: { status: 'PROCESSING' } });

  let result: { outputText?: string; outputUrl?: string };
  const model = resolved.model ?? '';

  try {
    if (slot.slotType === 'caption') {
      const system = resolved.system ?? '';
      const user = resolved.user ?? '';
      console.log(`  📝 [slot ${slot.slotIndex}] Generating caption (model=${model})`);
      const raw = model === 'gemini'
        ? await generateCaptionGemini({ system, user })
        : await generateCaptionOpenAI({ system, user });

      // Guarantee the 3 fixed hashtags are present regardless of what the model returned.
      // Models (especially Gemini) sometimes omit them despite instructions.
      const text = injectFixedHashtags(raw);
      if (text !== raw) {
        console.log(`  💉 [slot ${slot.slotIndex}] Injected missing fixed hashtags into caption`);
      }

      // Validate caption structure — length, no URLs (hashtags now guaranteed above)
      const capValidation = validateCaptionStructure(text);
      if (!capValidation.valid) {
        console.warn(`  ✗ [slot ${slot.slotIndex}] Caption structure invalid:`, capValidation.issues.join(' | '));
        throw new Error(`Caption structure failed: ${capValidation.issues.join('; ')}`);
      }
      console.log(`  ✓ [slot ${slot.slotIndex}] Caption structure valid`);
      result = { outputText: text };

    } else if (slot.slotType === 'image') {
      const prompt = resolved.prompt ?? '';
      let url: string;

      if (baseImageUrl) {
        // ── BASE IMAGE PRESENT: use real image editing (gpt-image-1 edit API) ──
        // Req 1-2, 17-18, 20: NOT text-to-image. The actual uploaded image bytes
        // are sent to the API and an edited version is returned.
        console.log(`  🖼 [slot ${slot.slotIndex}] Editing base image via gpt-image-1 (model=${model})`);

        if (model === 'gemini-imagen') {
          try {
            url = await generateImageGemini(prompt, baseImageUrl);
            url = await handleDataUrl(url, slot.jobId, slot.id, 'png', 'image/png');
          } catch (err) {
            if (err instanceof GeminiImageUnavailableError) {
              console.log(`  ↳ Gemini unavailable — falling back to gpt-image-1 edit`);
              url = await editImageGPT(prompt, baseImageUrl);
              url = await handleDataUrl(url, slot.jobId, slot.id, 'png', 'image/png');
            } else { throw err; }
          }
        } else {
          // openai-dalle slots with base image → gpt-image-1 edit (never DALL-E 3 generate)
          url = await editImageGPT(prompt, baseImageUrl);
          url = await handleDataUrl(url, slot.jobId, slot.id, 'png', 'image/png');
        }

        // NOTE: No programmatic circular overlay is added here.
        // The AI editing prompt (RULE 1 in wrapWithEditInstruction) explicitly instructs
        // the model to PRESERVE the existing circle from the base image exactly.
        // Adding a second circle programmatically was causing the double-circle bug.

      } else {
        // ── NO BASE IMAGE: standard generation ──────────────────────────────────
        if (model === 'gemini-imagen') {
          try {
            url = await generateImageGemini(prompt, undefined);
            url = await handleDataUrl(url, slot.jobId, slot.id, 'png', 'image/png');
          } catch (err) {
            if (err instanceof GeminiImageUnavailableError) {
              console.log(`  ↳ Gemini unavailable for slot ${slot.id}, falling back to DALL-E 3`);
              url = await generateImageDalle(prompt);
              if (config.r2BucketName && config.r2PublicUrl && !url.startsWith(config.r2PublicUrl) && !url.startsWith('data:')) {
                const key = `outputs/${slot.jobId}/${slot.id}/v0/${uuidv4()}.jpg`;
                url = await uploadUrlToR2(url, key, 'image/jpeg');
              }
            } else { throw err; }
          }
        } else {
          url = await generateImageDalle(prompt);
          if (config.r2BucketName && config.r2PublicUrl && !url.startsWith(config.r2PublicUrl) && !url.startsWith('data:')) {
            const key = `outputs/${slot.jobId}/${slot.id}/v0/${uuidv4()}.jpg`;
            url = await uploadUrlToR2(url, key, 'image/jpeg');
          }
        }
      }
      result = { outputUrl: url };

    } else if (slot.slotType === 'video') {
      const prompt = resolved.prompt ?? '';
      let url = await generateVideoKling(prompt, baseImageUrl ?? undefined);
      if (config.r2BucketName && config.r2PublicUrl && !url.startsWith(config.r2PublicUrl)) {
        const key = `outputs/${slot.jobId}/${slot.id}/v0/${uuidv4()}.mp4`;
        url = await uploadUrlToR2(url, key, 'video/mp4');
      }
      result = { outputUrl: url };

    } else {
      throw new Error(`Unknown slot type: ${slot.slotType}`);
    }

    await setCached(cacheKey, result);
    await db.outputSlot.update({
      where: { id: slot.id },
      data: {
        status: 'DONE',
        outputText: result.outputText,
        outputUrl: result.outputUrl,
        // Write the resolved prompt back to the snapshot so the DB reflects what was actually used
        promptSnapshot: JSON.stringify({ ...resolved }),
      },
    });
  } catch (err) {
    console.error(`Slot ${slot.id} (${model}) failed:`, (err as Error).message);
    await db.outputSlot.update({ where: { id: slot.id }, data: { status: 'FAILED' } });
    throw err;
  }
}

// ── Per-slot hard timeout ─────────────────────────────────────────────────────
// Req 28: If a slot hangs (network stall, API freeze), abort after this deadline
// and let the retry loop handle recovery instead of blocking the entire batch.
const SLOT_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes per attempt

function withSlotTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Slot timed out after ${SLOT_TIMEOUT_MS / 60000} min — ${label}`)),
        SLOT_TIMEOUT_MS
      )
    ),
  ]);
}

// ── Per-slot retry — NEVER throws; marks FAILED and returns so the next slot runs ──
// ROOT FIX: one slot failing must NOT stop the remaining 9 captions or images.
// Each slot is fully independent: retry up to maxAttempts, mark FAILED, move on.
async function processSlotWithRetry(
  slot: NonNullable<SlotRow>,
  baseImageUrl: string | null,
  newsInput: string
): Promise<void> {
  const maxAttempts = slot.slotType === 'image' ? 4 : 3;
  // Shorter delays to keep total time reasonable
  const baseRetryDelay = slot.slotType === 'image' ? 4000 : 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resolved = await resolveSlotPrompt(slot, newsInput, baseImageUrl);

    try {
      await withSlotTimeout(
        processSlot(slot, baseImageUrl, resolved),
        `slot ${slot.slotIndex} (${slot.slotType})`
      );
      return; // success
    } catch (err) {
      const msg = (err as Error).message ?? 'Unknown error';
      if (attempt < maxAttempts) {
        const delaySec = ((baseRetryDelay * attempt) / 1000).toFixed(0);
        console.log(`  ↺ [${slot.slotType} ${slot.slotIndex}] retry ${attempt + 1}/${maxAttempts} in ${delaySec}s — ${msg}`);
        await sleep(baseRetryDelay * attempt);
        await db.outputSlot.update({ where: { id: slot.id }, data: { status: 'PENDING' } });
      } else {
        // All retries exhausted — mark FAILED and RETURN (do NOT throw)
        // The caller (runSequential) will continue to the next slot.
        await db.outputSlot.update({ where: { id: slot.id }, data: { status: 'FAILED' } });
        console.error(`  ✗ [${slot.slotType} ${slot.slotIndex}] FAILED after ${maxAttempts} attempts: ${msg}`);
        return; // <-- key: return, not throw
      }
    }
  }
}

// ── Sequential execution: every slot runs regardless of previous slot outcome ──
// Caption 1 → Caption 2 → Caption 3 ... (each independent, no early abort)
// Image 1 → Image 2 → Image 3 ... (same principle)
async function runSequential(
  slots: NonNullable<SlotRow>[],
  baseImageUrl: string | null,
  newsInput: string
): Promise<void> {
  for (let i = 0; i < slots.length; i++) {
    // processSlotWithRetry never throws — each slot runs no matter what
    await processSlotWithRetry(slots[i], baseImageUrl, newsInput);
    if (i < slots.length - 1) {
      // 3s gap between images, 2.5s between captions (prevents rate-limit failures)
      const gap = slots[i].slotType === 'image' ? 3000 : 2500;
      console.log(`  ⏱ [${slots[i].slotType}] gap ${gap / 1000}s → slot ${slots[i + 1].slotIndex}`);
      await sleep(gap);
    }
  }
}

async function processJob(jobId: string): Promise<void> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { outputSlots: true },
  });

  if (!job) { console.error(`Job ${jobId} not found`); return; }

  await db.job.update({ where: { id: jobId }, data: { status: 'PROCESSING' } });
  console.log(`⚡ Processing job ${jobId} (${job.outputSlots.length} slots)`);

  const newsInput = job.newsInput ?? '';
  const baseImageUrl = job.baseImageUrl ?? null;

  const captions = job.outputSlots.filter((s) => s.slotType === 'caption');
  const images = job.outputSlots.filter((s) => s.slotType === 'image');
  const videos = job.outputSlots.filter((s) => s.slotType === 'video');

  // Req 24: Check API health before starting image generation
  if (images.length > 0) {
    console.log(`  🩺 Checking OpenAI API health before image generation...`);
    let healthy = false;
    for (let probe = 1; probe <= 3; probe++) {
      healthy = await probeApiHealth();
      if (healthy) { console.log(`  ✓ API healthy`); break; }
      console.warn(`  ⚠ API health check failed (probe ${probe}/3) — waiting 10s...`);
      await sleep(10000);
    }
    if (!healthy) {
      console.error(`  ✗ OpenAI API unreachable after 3 probes — aborting image group`);
      for (const s of images) {
        await db.outputSlot.update({ where: { id: s.id }, data: { status: 'FAILED' } });
      }
      await db.job.update({
        where: { id: jobId },
        data: { status: 'FAILED', completedAt: new Date(), errorMsg: 'OpenAI API unreachable before image generation' },
      });
      return;
    }
  }

  let failedCount = 0;
  let errorMsg: string | null = null;

  // Run each type sequentially. If a slot throws (all retries exhausted), remaining slots of that type are skipped.
  for (const group of [captions, images, videos]) {
    try {
      await runSequential(group, baseImageUrl, newsInput);
    } catch (err) {
      failedCount++;
      errorMsg = (err as Error).message ?? 'A slot failed after all retries';
      console.error(`Job ${jobId}: group stopped early —`, errorMsg);
    }
  }

  // Count any remaining FAILED slots (includes partial failures)
  const finalSlots = await db.outputSlot.findMany({ where: { jobId } });
  failedCount = finalSlots.filter((s) => s.status === 'FAILED').length;

  await db.job.update({
    where: { id: jobId },
    data: {
      status: failedCount === 0 ? 'DONE' : 'FAILED',
      completedAt: new Date(),
      errorMsg: failedCount === 0 ? null : `${failedCount} slot(s) failed after retries`,
    },
  });

  console.log(`✅ Job ${jobId}: ${failedCount === 0 ? 'DONE' : `FAILED (${failedCount} slots failed)`}`);
}

jobQueue.on('job', async (job: { id: string; data: { jobId: string } }) => {
  try {
    await processJob(job.data.jobId);
  } catch (err) {
    console.error(`Worker error on job ${job.data.jobId}:`, err);
  }
});

console.log('✅ Job worker ready — v10: no-double-circle, 10-variation-uniqueness, circle-preserve-prompt, text-logo-removal');
