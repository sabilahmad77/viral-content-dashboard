# Viral Content Dashboard

AI-powered viral content generation platform for social media teams.

## Quick Start

### 1. Prerequisites
- Node.js 20+, pnpm 8+, Docker

### 2. Start Infrastructure
```bash
docker-compose up -d
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Configure Environment
```bash
cp .env.example apps/api/.env
# Edit apps/api/.env with your API keys
```

### 5. Run Database Migrations & Seed
```bash
pnpm --filter api db:generate
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

### 6. Start Development Servers
```bash
# Terminal 1 — API server
pnpm --filter api dev

# Terminal 2 — BullMQ worker
pnpm --filter api worker

# Terminal 3 — Next.js frontend
pnpm --filter web dev
```

Open http://localhost:3000 and log in with your seeded admin credentials.

## Default Login
- Email: as set in `SEED_ADMIN_EMAIL`
- Password: as set in `SEED_ADMIN_PASSWORD`

## Architecture
- **Frontend**: Next.js 14 (App Router) — http://localhost:3000
- **API**: Express.js — http://localhost:3001
- **Database**: PostgreSQL 15
- **Queue**: Redis + BullMQ
- **Storage**: Cloudflare R2

## Required API Keys
| Service | Env Var | Purpose |
|---------|---------|---------|
| OpenAI | `OPENAI_API_KEY` | Caption generation |
| Anthropic | `ANTHROPIC_API_KEY` | Caption variation |
| Flux (BFL) | `BFL_API_KEY` | Image generation |
| Ideogram | `IDEOGRAM_API_KEY` | Text-overlay images |
| Kling AI | `KLING_API_KEY` | Video generation |
| Cloudflare R2 | `R2_*` | File storage |
