import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import db from '../lib/db';
import { requireAuth } from '../middleware/auth';
import { jobQueue } from '../lib/queue';
import { uploadToR2 } from '../services/storage';
import { buildCaptionSystemPrompt, buildImagePrompt } from './templates';
import { getProviderForImageSlot } from '../lib/providerSequence';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  },
});

const createJobSchema = z.object({
  // newsInput is optional for image-only mode (user may supply only a base image)
  newsInput: z.string().max(2000).default(''),
  mode: z.enum(['content', 'images', 'all']).default('all'),
  // imageCount: how many images to generate (1–20). Defaults to 10.
  imageCount: z.coerce.number().int().min(1).max(20).default(10),
}).refine((data) => {
  // Captions always require text (no text = no captions possible)
  if (data.mode === 'content' || data.mode === 'all') {
    return data.newsInput.trim().length > 0;
  }
  return true; // images can work with empty text (base image only)
}, { message: 'Text input is required for caption generation' });

function renderPrompt(template: string, newsInput: string): string {
  return template.replace(/\{\{newsInput\}\}/g, newsInput);
}

function parseSlots(raw: unknown): Array<Record<string, unknown>> {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  return [];
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

// POST /api/jobs
router.post('/', requireAuth, upload.single('baseImage'), async (req: Request, res: Response): Promise<void> => {
  const result = createJobSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: 'Validation failed', details: result.error.flatten() }); return; }

  const user = await db.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || !user.isActive) { res.status(403).json({ error: 'Account is inactive' }); return; }

  const activeTemplate = await db.promptTemplate.findFirst({ where: { isActive: true } });
  if (!activeTemplate) { res.status(400).json({ error: 'No active prompt template. Ask an admin to activate one.' }); return; }

  let baseImageUrl: string | undefined;
  if (req.file) {
    const ext = req.file.mimetype.split('/')[1];
    const key = `uploads/${req.user!.userId}/${uuidv4()}.${ext}`;
    try {
      baseImageUrl = await uploadToR2(req.file.buffer, key, req.file.mimetype);
    } catch {
      // R2 not configured — convert to base64 data URL so the worker can still read and edit it
      const b64 = req.file.buffer.toString('base64');
      baseImageUrl = `data:${req.file.mimetype};base64,${b64}`;
    }
  }

  // Caption slots — always sourced from the active template
  const allSlots = parseSlots(activeTemplate.slots);
  const captionSlots = allSlots.filter((s) => String(s.type) === 'caption');
  const captionJson = parseJsonObj(activeTemplate.captionPromptJson);
  const imageJson = parseJsonObj(activeTemplate.imagePromptJson);
  const hasCaptionJson = Object.keys(captionJson).length > 0;
  const hasImageJson = Object.keys(imageJson).length > 0;

  const { mode, imageCount, newsInput } = result.data;

  const job = await db.$transaction(async (tx) => {
    const newJob = await tx.job.create({
      data: {
        userId: req.user!.userId,
        templateId: activeTemplate.id,
        templateVersion: activeTemplate.version,
        newsInput,
        baseImageUrl,
        status: 'QUEUED',
      },
    });

    // ── Caption slots (from template) ──────────────────────────────────────────
    const captionSlotData = (mode === 'content' || mode === 'all')
      ? captionSlots.map((slot) => {
          const label = String(slot.label ?? '');
          const promptSnapshot: Record<string, unknown> = { type: 'caption', index: slot.index, label, model: slot.model };
          if (hasCaptionJson) {
            promptSnapshot.system = buildCaptionSystemPrompt(captionJson, label);
            promptSnapshot.user = newsInput
              ? `Topic/Content: ${newsInput}`
              : 'Generate the caption based on the provided rules.';
          } else {
            promptSnapshot.system = slot.system;
            promptSnapshot.user = renderPrompt(String(slot.user ?? ''), newsInput);
          }
          return {
            jobId: newJob.id,
            slotType: 'caption',
            slotIndex: Number(slot.index),
            status: 'PENDING',
            promptSnapshot: JSON.stringify(promptSnapshot),
            modelUsed: String(slot.model),
          };
        })
      : [];

    // ── Image slots (provider sequence: Gemini→OpenAI→FLUX in groups of 3) ────
    // Created dynamically — imageCount controls exactly how many are generated.
    // Provider assignment: slots 0-2=Gemini, 3-5=OpenAI, 6-8=FLUX, 9-11=Gemini…
    const imageSlotData = (mode === 'images' || mode === 'all')
      ? Array.from({ length: imageCount }, (_, i) => {
          const provider = getProviderForImageSlot(i);
          const promptSnapshot: Record<string, unknown> = {
            type: 'image', index: i, label: `Image ${i + 1}`, model: provider,
          };
          if (hasImageJson) {
            promptSnapshot.prompt = buildImagePrompt(imageJson, `Image ${i + 1}`, newsInput);
          }
          return {
            jobId: newJob.id,
            slotType: 'image',
            slotIndex: i,
            status: 'PENDING',
            promptSnapshot: JSON.stringify(promptSnapshot),
            modelUsed: provider,
          };
        })
      : [];

    await tx.outputSlot.createMany({ data: [...captionSlotData, ...imageSlotData] });

    return newJob;
  });

  await jobQueue.add('process-job', { jobId: job.id }, { jobId: job.id });

  const totalSlots = (mode === 'images' ? imageCount : 0) + (mode === 'content' || mode === 'all' ? captionSlots.length : 0) + (mode === 'all' ? imageCount : 0);
  res.status(202).json({ jobId: job.id, slotCount: totalSlots, imageCount: mode !== 'content' ? imageCount : 0, estimatedSeconds: 30 });
});

// GET /api/jobs
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const isAdmin = req.user!.role === 'SUPER_ADMIN';
  const where = isAdmin ? {} : { userId: req.user!.userId };

  try {
    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          outputSlots: { select: { slotType: true, status: true } },
        },
      }),
      db.job.count({ where }),
    ]);
    res.json({ jobs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/jobs/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await db.job.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        template: { select: { id: true, name: true, version: true } },
        outputSlots: { orderBy: [{ slotType: 'asc' }, { slotIndex: 'asc' }] },
      },
    });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    if (job.userId !== req.user!.userId && req.user!.role !== 'SUPER_ADMIN') { res.status(403).json({ error: 'Forbidden' }); return; }

    // Parse JSON string fields for client
    const parsed = {
      ...job,
      outputSlots: job.outputSlots.map((s) => ({
        ...s,
        promptSnapshot: typeof s.promptSnapshot === 'string' ? JSON.parse(s.promptSnapshot as string) : s.promptSnapshot,
        regenHistory: typeof s.regenHistory === 'string' ? JSON.parse(s.regenHistory as string) : s.regenHistory,
      })),
    };
    res.json(parsed);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/jobs/:id/status
router.get('/:id/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await db.job.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, status: true, createdAt: true, completedAt: true, errorMsg: true,
        outputSlots: {
          select: { id: true, slotType: true, slotIndex: true, status: true },
          orderBy: [{ slotType: 'asc' }, { slotIndex: 'asc' }],
        },
      },
    });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    res.json(job);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
