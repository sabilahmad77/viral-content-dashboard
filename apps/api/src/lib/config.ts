import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  BFL_API_KEY: z.string().optional(),
  FAL_KEY: z.string().optional(),
  IDEOGRAM_API_KEY: z.string().optional(),
  KLING_API_KEY: z.string().optional(),
  RUNWAY_API_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_API_URL: z.string().optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_NAME: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  process.stdout.write('❌ FATAL: Invalid environment variables:\n');
  process.stdout.write(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2) + '\n');
  process.exit(1);
}

export const config = {
  databaseUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  jwtRefreshSecret: parsed.data.JWT_REFRESH_SECRET,
  openaiApiKey: parsed.data.OPENAI_API_KEY,
  geminiApiKey: parsed.data.GEMINI_API_KEY,
  anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
  bflApiKey: parsed.data.BFL_API_KEY,
  falKey: parsed.data.FAL_KEY,
  ideogramApiKey: parsed.data.IDEOGRAM_API_KEY,
  klingApiKey: parsed.data.KLING_API_KEY,
  runwayApiKey: parsed.data.RUNWAY_API_KEY,
  r2AccountId: parsed.data.R2_ACCOUNT_ID,
  r2AccessKeyId: parsed.data.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: parsed.data.R2_SECRET_ACCESS_KEY,
  r2BucketName: parsed.data.R2_BUCKET_NAME,
  r2PublicUrl: parsed.data.R2_PUBLIC_URL,
  port: parseInt(parsed.data.PORT, 10),
  nodeEnv: parsed.data.NODE_ENV,
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
  seed: {
    adminEmail: parsed.data.SEED_ADMIN_EMAIL,
    adminPassword: parsed.data.SEED_ADMIN_PASSWORD,
    adminName: parsed.data.SEED_ADMIN_NAME,
  },
} as const;
