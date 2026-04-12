import { createHash } from 'crypto';
import { redis } from './redis';

const CACHE_TTL = 86400; // 24 hours

export function hashPrompt(data: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

export async function getCached<T>(key: string): Promise<T | null> {
  const raw = await redis.get(`cache:${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttl = CACHE_TTL): Promise<void> {
  await redis.setex(`cache:${key}`, ttl, JSON.stringify(value));
}
