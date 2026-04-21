import 'dotenv/config';

// ── Startup diagnostics ───────────────────────────────────────────────────────
console.log('🚀 Starting API server...');
console.log(`   NODE_ENV  = ${process.env.NODE_ENV}`);
console.log(`   PORT      = ${process.env.PORT}`);
console.log(`   DB URL    = ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:\/\/.*@/, '://***@') : 'NOT SET'}`);

// Import the shared Express app
import app from './app';
import { config } from './lib/config';

// Import worker so job processing runs in the same long-lived process
import './workers/jobWorker';

app.listen(config.port, '0.0.0.0', () => {
  process.stdout.write(`\n✅ Viral Content Dashboard API running\n`);
  process.stdout.write(`   → http://0.0.0.0:${config.port}\n`);
  process.stdout.write(`   → Health: http://0.0.0.0:${config.port}/health\n\n`);
});

export default app;
