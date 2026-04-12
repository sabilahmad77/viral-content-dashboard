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
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Dev: allow localhost
    if (config.isDev) {
      if (origin.startsWith('http://localhost')) return callback(null, true);
    }
    // Prod: allow the configured frontend URL or any vercel.app subdomain
    const allowed = process.env.FRONTEND_URL;
    if (allowed && origin === allowed) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow same-origin requests
    callback(null, true);
  },
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
