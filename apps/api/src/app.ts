/**
 * Express app factory — shared between the Node server (src/index.ts)
 * and the Vercel serverless entry point (api/index.ts).
 * Does NOT call app.listen() and does NOT start the BullMQ worker.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './lib/config';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import templateRoutes from './routes/templates';
import jobRoutes from './routes/jobs';
import outputRoutes from './routes/outputs';
import adminRoutes from './routes/admin';
import videoRoutes from './routes/videos';

const app = express();

app.use(helmet());
app.use(cors({
  origin: (_origin, callback) => callback(null, true),
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const globalLimiter = rateLimit({ windowMs: 60_000, max: 500, standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api', outputRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/videos', videoRoutes);

app.use(errorHandler);

export default app;
