import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';

const router = Router();

// GET /api/admin/usage
router.get('/usage', requireAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalJobs, todayJobs, totalSlots, failedSlots, slotsByModel] = await Promise.all([
      db.job.count({ where: { createdAt: { gte: startOfMonth } } }),
      db.job.count({ where: { createdAt: { gte: startOfToday } } }),
      db.outputSlot.count({ where: { createdAt: { gte: startOfMonth }, status: 'DONE' } }),
      db.outputSlot.count({ where: { createdAt: { gte: startOfMonth }, status: 'FAILED' } }),
      db.outputSlot.groupBy({
        by: ['modelUsed'],
        where: { createdAt: { gte: startOfMonth } },
        _count: { _all: true },
      }),
    ]);

    // Rough cost estimates per call
    const costMap: Record<string, number> = {
      openai: 0.005,
      anthropic: 0.004,
      flux: 0.05,
      ideogram: 0.04,
      kling: 0.15,
      runway: 0.2,
    };

    const totalApiCalls = totalSlots;
    const estimatedCost = slotsByModel.reduce((sum, row) => {
      const model = row.modelUsed ?? 'openai';
      return sum + (costMap[model] ?? 0.01) * row._count._all;
    }, 0);

    const errorRate = totalSlots + failedSlots > 0
      ? ((failedSlots / (totalSlots + failedSlots)) * 100).toFixed(2)
      : '0.00';

    const activeUsers = await db.user.count({ where: { isActive: true } });

    res.json({
      todayJobs,
      totalApiCalls,
      estimatedCost: parseFloat(estimatedCost.toFixed(2)),
      errorRate: parseFloat(errorRate),
      activeUsers,
      slotsByModel,
      period: { start: startOfMonth, end: now },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/logs — recent job activity
router.get('/logs', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const limit = parseInt(req.query.limit as string) || 50;
  try {
    const jobs = await db.job.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { outputSlots: true } },
      },
    });
    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/jobs
router.get('/jobs', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    const [jobs, total] = await Promise.all([
      db.job.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          outputSlots: { select: { slotType: true, status: true } },
        },
      }),
      db.job.count(),
    ]);
    res.json({ jobs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
