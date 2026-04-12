FROM node:20-alpine

# Install pnpm + build deps for native modules (sharp)
RUN apk add --no-cache python3 make g++ && npm install -g pnpm

WORKDIR /app

# Copy workspace manifests
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma

# Install dependencies
RUN pnpm install --frozen-lockfile --filter api...

# Copy API source
COPY apps/api apps/api

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build TypeScript
RUN cd apps/api && npx tsc

# Create data directory for SQLite persistence
RUN mkdir -p /data

EXPOSE 3001

# On start: run migrations then start server
CMD sh -c "cd apps/api && npx prisma migrate deploy && node dist/index.js"
