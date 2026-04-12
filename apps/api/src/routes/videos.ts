import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../lib/db';
import { requireAuth } from '../middleware/auth';
import { jobQueue } from '../lib/queue';

const router = Router();

const generateVideoSchema = z.object({
  mode: z.enum(['prompt', 'config']),
  prompt: z.string().min(1).max(2000).optional(),
  topic: z.string().max(500).optional(),
  config: z.record(z.unknown()).optional(),
});

// POST /api/videos/generate
router.post('/generate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const result = generateVideoSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    return;
  }

  const { mode, prompt, topic, config } = result.data;

  const user = await db.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || !user.isActive) {
    res.status(403).json({ error: 'Account is inactive' });
    return;
  }

  // Look up Video Studio template (required for FK constraint)
  const videoTemplate = await db.promptTemplate.findUnique({ where: { slug: 'video-studio' } });
  if (!videoTemplate) {
    res.status(500).json({ error: 'Video Studio template not found. Please reseed the database.' });
    return;
  }

  // Build the final prompt based on mode
  let videoPrompt: string;
  let label: string;

  if (mode === 'prompt') {
    if (!prompt) {
      res.status(400).json({ error: 'prompt is required for prompt mode' });
      return;
    }
    videoPrompt = prompt;
    label = 'Video — Custom Prompt';
  } else {
    // config mode: build prompt from config fields
    if (!config) {
      res.status(400).json({ error: 'config is required for config mode' });
      return;
    }
    const t = topic || 'breaking news';
    const cfgPrompt = config.prompt as string | undefined;

    if (cfgPrompt) {
      videoPrompt = cfgPrompt.replace('{topic}', t).replace('{{topic}}', t);
    } else {
      const style = (config.style as string) || 'cinematic';
      const duration = (config.duration as number) || 5;
      const scenes = config.scenes as Array<{ description: string }> | undefined;
      const sceneDesc = scenes ? `Scenes: ${scenes.map((s) => s.description).join(' → ')}. ` : '';
      videoPrompt = `Create a ${style} ${duration}-second video about: ${t}. ${sceneDesc}High production quality, broadcast standard.`;
    }
    label = 'Video — Config-based';
  }

  const newsInput = topic || prompt || 'Video Studio Generation';

  const promptSnapshot = {
    type: 'video',
    index: 0,
    label,
    model: 'kling',
    prompt: videoPrompt,
    mode,
    ...(mode === 'config' && config ? { config } : {}),
  };

  try {
    const job = await db.$transaction(async (tx) => {
      const newJob = await tx.job.create({
        data: {
          userId: req.user!.userId,
          templateId: videoTemplate.id,
          templateVersion: videoTemplate.version,
          newsInput,
          status: 'QUEUED',
        },
      });

      await tx.outputSlot.create({
        data: {
          jobId: newJob.id,
          slotType: 'video',
          slotIndex: 0,
          status: 'PENDING',
          modelUsed: 'kling',
          promptSnapshot: JSON.stringify(promptSnapshot),
          regenCount: 0,
          regenHistory: JSON.stringify([]),
        },
      });

      return newJob;
    });

    await jobQueue.add('process-video', { jobId: job.id });

    res.status(201).json({ jobId: job.id, estimatedSeconds: 90 });
  } catch (err) {
    console.error('Video generation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
