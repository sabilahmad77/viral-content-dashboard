import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../lib/db';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';

const router = Router();

const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  // TXT instruction fields (plain text, no validation needed)
  contentInstructions: z.string().optional(),
  imageInstructions: z.string().optional(),
  videoInstructions: z.string().optional(),
  // Legacy JSON fields — kept for backward compatibility
  captionPromptJson: z.string().optional(),
  imagePromptJson: z.string().optional(),
});

function parseJson(val: unknown, fallback: unknown = []): unknown {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return fallback; } }
  return val ?? fallback;
}

function serializeTemplate(t: Record<string, unknown>) {
  return {
    ...t,
    slots: parseJson(t.slots, []),
    // Return TXT fields as-is (strings)
    contentInstructions: t.contentInstructions ?? '',
    imageInstructions: t.imageInstructions ?? '',
    videoInstructions: t.videoInstructions ?? '',
    // Legacy JSON — still returned for any clients that read it
    captionPromptJson: parseJson(t.captionPromptJson, {}),
    imagePromptJson: parseJson(t.imagePromptJson, {}),
  };
}

router.get('/', requireAuth, async (_req, res: Response): Promise<void> => {
  try {
    const templates = await db.promptTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
    res.json(templates.map((t) => serializeTemplate(t as Record<string, unknown>)));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await db.promptTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
    res.json(serializeTemplate(template as Record<string, unknown>));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/templates/:id
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const result = templateUpdateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    return;
  }

  try {
    const existing = await db.promptTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: 'Template not found' }); return; }

    const updateData: Record<string, unknown> = { version: existing.version + 1 };
    if (result.data.name) updateData.name = result.data.name;
    if (result.data.contentInstructions !== undefined) updateData.contentInstructions = result.data.contentInstructions;
    if (result.data.imageInstructions !== undefined) updateData.imageInstructions = result.data.imageInstructions;
    if (result.data.videoInstructions !== undefined) updateData.videoInstructions = result.data.videoInstructions;
    if (result.data.captionPromptJson !== undefined) updateData.captionPromptJson = result.data.captionPromptJson;
    if (result.data.imagePromptJson !== undefined) updateData.imagePromptJson = result.data.imagePromptJson;

    const template = await db.promptTemplate.update({ where: { id: req.params.id }, data: updateData });
    res.json(serializeTemplate(template as Record<string, unknown>));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/activate', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.$transaction([
      db.promptTemplate.updateMany({ data: { isActive: false } }),
      db.promptTemplate.update({ where: { id: req.params.id }, data: { isActive: true } }),
    ]);
    res.json({ message: 'Template activated' });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') { res.status(404).json({ error: 'Template not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.promptTemplate.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Template deactivated' });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') { res.status(404).json({ error: 'Template not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Shared prompt-building helpers (used by worker for generation) ─────────────
// TXT instructions take full priority. When set, they are used verbatim.
// JSON-based helpers remain as fallback for templates that haven't migrated to TXT.

export function buildCaptionSystemPrompt(captionJson: Record<string, unknown>, variationAngle: string): string {
  if (typeof captionJson.systemPrompt === 'string' && captionJson.systemPrompt.trim()) {
    return captionJson.systemPrompt;
  }
  const lines: string[] = [];
  if (captionJson.instruction) lines.push(String(captionJson.instruction));
  if (captionJson.tone) lines.push(`Tone: ${captionJson.tone}`);
  if (captionJson.style) lines.push(`Style: ${captionJson.style}`);
  if (captionJson.maxLength) lines.push(`Max length: ${captionJson.maxLength} characters`);
  if (captionJson.format) lines.push(`Format: ${captionJson.format}`);
  if (captionJson.language) lines.push(`Language: ${captionJson.language}`);
  if (captionJson.platform) lines.push(`Platform: ${captionJson.platform}`);
  if (Array.isArray(captionJson.forbidden) && captionJson.forbidden.length > 0) {
    lines.push(`Forbidden (never use): ${(captionJson.forbidden as string[]).join(', ')}`);
  }
  if (Array.isArray(captionJson.required) && captionJson.required.length > 0) {
    lines.push(`Required (must include): ${(captionJson.required as string[]).join(', ')}`);
  }
  if (Array.isArray(captionJson.variations)) {
    const variation = (captionJson.variations as Array<{ angle: string; instruction: string }>)
      .find((v) => v.angle?.toLowerCase() === variationAngle?.toLowerCase());
    if (variation?.instruction) lines.push(`Variation direction: ${variation.instruction}`);
  }
  const knownKeys = new Set(['systemPrompt', 'instruction', 'tone', 'style', 'maxLength', 'format', 'language', 'platform', 'forbidden', 'required', 'variations']);
  for (const key of Object.keys(captionJson)) {
    if (!knownKeys.has(key)) lines.push(`${key}: ${JSON.stringify(captionJson[key])}`);
  }
  return lines.join('\n');
}

export function buildImagePrompt(imageJson: Record<string, unknown>, variationAngle: string, newsInput: string): string {
  if (typeof imageJson.prompt === 'string' && imageJson.prompt.trim()) {
    return newsInput ? imageJson.prompt.replace(/\{\{newsInput\}\}/g, newsInput) : imageJson.prompt;
  }
  const lines: string[] = [];
  if (imageJson.instruction) lines.push(String(imageJson.instruction));
  if (imageJson.style) lines.push(`Style: ${imageJson.style}`);
  if (imageJson.mood) lines.push(`Mood: ${imageJson.mood}`);
  if (imageJson.colorPalette) lines.push(`Color palette: ${imageJson.colorPalette}`);
  if (imageJson.composition) lines.push(`Composition: ${imageJson.composition}`);
  if (imageJson.lighting) lines.push(`Lighting: ${imageJson.lighting}`);
  if (imageJson.quality) lines.push(`Quality: ${imageJson.quality}`);
  if (imageJson.aspectRatio) lines.push(`Aspect ratio: ${imageJson.aspectRatio}`);
  if (imageJson.subject) lines.push(`Subject: ${imageJson.subject}`);
  if (Array.isArray(imageJson.restrictions) && imageJson.restrictions.length > 0) {
    lines.push(`Restrictions (never include): ${(imageJson.restrictions as string[]).join(', ')}`);
  }
  if (Array.isArray(imageJson.required) && imageJson.required.length > 0) {
    lines.push(`Required elements: ${(imageJson.required as string[]).join(', ')}`);
  }
  if (imageJson.baseImageBehavior) lines.push(`Base image behavior: ${imageJson.baseImageBehavior}`);
  if (Array.isArray(imageJson.variations)) {
    const variation = (imageJson.variations as Array<{ angle: string; instruction: string }>)
      .find((v) => v.angle?.toLowerCase() === variationAngle?.toLowerCase());
    if (variation?.instruction) lines.push(`Variation direction: ${variation.instruction}`);
  }
  const knownKeys = new Set(['prompt', 'instruction', 'style', 'mood', 'colorPalette', 'composition', 'lighting', 'quality', 'aspectRatio', 'subject', 'restrictions', 'required', 'baseImageBehavior', 'variations']);
  for (const key of Object.keys(imageJson)) {
    if (!knownKeys.has(key)) lines.push(`${key}: ${JSON.stringify(imageJson[key])}`);
  }
  const rulesBlock = lines.join('. ');
  return newsInput ? `${rulesBlock}. Topic: ${newsInput}` : rulesBlock;
}

export default router;
