import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './lib/config';
import { errorHandler } from './middleware/errorHandler';

// Import worker inline so job processing happens in the same process
import './workers/jobWorker';

// Routes
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
  origin: config.isDev
    ? ['http://localhost:3000', 'http://localhost:3001']
    : (process.env.FRONTEND_URL ?? '*'),
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

app.listen(config.port, () => {
  console.log(`\n✅ Viral Content Dashboard API running`);
  console.log(`   → http://localhost:${config.port}`);
  console.log(`   → Health: http://localhost:${config.port}/health\n`);
});

export default app;
