import { PrismaClient } from '@prisma/client';
import { config } from './config';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: config.isDev ? ['error', 'warn'] : ['error'],
  });

if (config.isDev) globalForPrisma.prisma = db;

export default db;
