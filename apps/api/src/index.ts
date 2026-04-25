import 'dotenv/config';

// ── Startup diagnostics ───────────────────────────────────────────────────────
console.log('🚀 Starting API server...');
console.log(`   NODE_ENV  = ${process.env.NODE_ENV}`);
console.log(`   PORT      = ${process.env.PORT}`);
console.log(`   DB URL    = ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:\/\/.*@/, '://***@') : 'NOT SET'}`);
console.log(`   JWT_SECRET length = ${process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0}`);

// Import the shared Express app (this triggers config.ts Zod validation)
import app from './app';
import { config } from './lib/config';
import db from './lib/db';
import bcrypt from 'bcryptjs';

// Import worker so job processing runs in the same long-lived process
import './workers/jobWorker';

app.listen(config.port, '0.0.0.0', () => {
  process.stdout.write(`\n✅ Viral Content Dashboard API running\n`);
  process.stdout.write(`   → http://0.0.0.0:${config.port}\n`);
  process.stdout.write(`   → Health: http://0.0.0.0:${config.port}/health\n\n`);

  // Ensure admin user exists — non-fatal if DB is temporarily unavailable
  ensureAdmin().catch(e =>
    process.stdout.write(`⚠️  Admin seed skipped: ${e.message}\n`)
  );
});

/**
 * Creates the admin user if it does not already exist.
 * Uses env vars when set, falls back to defaults so the app is always usable.
 */
async function ensureAdmin(): Promise<void> {
  const email    = config.seed.adminEmail    ?? 'admin@viraldash.com';
  const password = config.seed.adminPassword ?? 'Admin1234!';
  const name     = config.seed.adminName     ?? 'Super Admin';

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.user.create({
        data: { email, passwordHash, name, role: 'SUPER_ADMIN' },
      });
      process.stdout.write(`✅ Admin user created: ${email}\n`);
    } else {
      process.stdout.write(`ℹ️  Admin user already exists: ${email}\n`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`⚠️  ensureAdmin error: ${msg}\n`);
  }
}

export default app;
