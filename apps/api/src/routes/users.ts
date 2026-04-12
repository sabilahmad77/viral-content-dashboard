import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../lib/db';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['SUPER_ADMIN', 'USER']).default('USER'),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['SUPER_ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

// GET /api/users
router.get('/', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    const [users, total] = await Promise.all([
      db.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, name: true, role: true,
          isActive: true, createdAt: true, lastLogin: true,
          _count: { select: { jobs: true } },
        },
      }),
      db.user.count(),
    ]);

    res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    return;
  }

  const { email, password, name, role } = result.data;

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: { email, passwordHash, name, role },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    return;
  }

  const { password, ...rest } = result.data;

  try {
    const updateData: Record<string, unknown> = { ...rest };
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await db.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, isActive: true, updatedAt: true },
    });

    res.json(user);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id/deactivate
router.patch('/:id/deactivate', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  if (req.params.id === req.user!.userId) {
    res.status(400).json({ error: 'Cannot deactivate your own account' });
    return;
  }

  try {
    await db.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    // Revoke all refresh tokens
    await db.refreshToken.updateMany({
      where: { userId: req.params.id },
      data: { revoked: true },
    });
    res.json({ message: 'User deactivated' });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
