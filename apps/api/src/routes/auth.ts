import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { z } from 'zod';
import db from '../lib/db';
import { config } from '../lib/config';
import { requireAuth } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateTokens(userId: string, email: string, role: string) {
  const accessToken = jwt.sign(
    { userId, email, role },
    config.jwtSecret,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, email, role },
    config.jwtRefreshSecret,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid email or password format', details: result.error.flatten() });
    return;
  }

  const { email, password } = result.data;

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

    // Store hashed refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      },
    });

    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as {
      userId: string;
      email: string;
      role: string;
    };

    const tokenHash = hashToken(refreshToken);
    const stored = await db.refreshToken.findFirst({
      where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
    });

    if (!stored) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    // Rotate tokens
    await db.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const tokens = generateTokens(user.id, user.email, user.role);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(tokens.refreshToken),
        expiresAt,
      },
    });

    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await db.refreshToken.updateMany({
      where: { tokenHash, userId: req.user!.userId },
      data: { revoked: true },
    });
  }
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true, lastLogin: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
