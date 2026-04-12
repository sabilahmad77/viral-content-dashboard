import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: admin access required' });
    return;
  }
  next();
}
