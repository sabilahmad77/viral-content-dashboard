import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from './db';
import { config } from './config';

const DEFAULT_SLOTS = [
  // ── Captions (10) — alternating OpenAI GPT-4o and Google Gemini ──────────
  { type: 'caption', index: 0, label: 'Caption 1 — Breaking News', model: 'openai', system: 'You are a viral social media content writer. Write punchy, engaging captions for breaking news.', user: 'Write a short viral caption (max 150 chars) for this news: {{newsInput}}' },
  { type: 'caption', index: 1, label: 'Caption 2 — Emotional Hook', model: 'gemini', system: 'You are a viral social media content writer specializing in emotional storytelling.', user: 'Write an emotionally compelling caption (max 180 chars) for this news: {{newsInput}}' },
  { type: 'caption', index: 2, label: 'Caption 3 — Question Format', model: 'openai', system: 'You write viral social captions that use questions to drive engagement.', user: 'Write a question-format viral caption for this news: {{newsInput}}' },
  { type: 'caption', index: 3, label: 'Caption 4 — Data/Stats Angle', model: 'gemini', system: 'You write fact-based, data-driven social media captions.', user: 'Write a data/stats-focused viral caption for this news: {{newsInput}}' },
  { type: 'caption', index: 4, label: 'Caption 5 — Controversy Angle', model: 'openai', system: 'You write provocative, debate-starting social media captions.', user: 'Write a controversy-angle viral caption for this news: {{newsInput}}' },
  { type: 'caption', index: 5, label: 'Caption 6 — Storytelling', model: 'gemini', system: 'You write story-driven social media captions.', user: 'Write a short storytelling-style viral caption for this news: {{newsInput}}' },
  { type: 'caption', index: 6, label: 'Caption 7 — Call to Action', model: 'openai', system: 'You write action-driving social media captions with strong CTAs.', user: 'Write a viral caption with a strong call to action for this news: {{newsInput}}' },
  { type: 'caption', index: 7, label: 'Caption 8 — Humor/Meme Angle', model: 'gemini', system: 'You write witty, humorous, meme-worthy social media captions that go viral.', user: 'Write a funny, meme-style viral caption (max 160 chars) for this news: {{newsInput}}' },
  { type: 'caption', index: 8, label: 'Caption 9 — Urgency Alert', model: 'openai', system: 'You write urgent, time-sensitive social media captions that compel immediate action.', user: 'Write an urgent, BREAKING alert-style viral caption (max 140 chars) for this news: {{newsInput}}' },
  { type: 'caption', index: 9, label: 'Caption 10 — Empathy/Compassion', model: 'gemini', system: 'You write empathetic, compassionate social media captions that connect deeply with audiences.', user: 'Write an empathetic, human-interest viral caption (max 180 chars) for this news: {{newsInput}}' },

  // ── Images (10) — alternating OpenAI DALL-E 3 and Google Gemini Imagen ───
  { type: 'image', index: 0, label: 'Image 1 — DALL-E Hero Shot', model: 'openai-dalle', prompt: 'Create a high-impact, cinematic news photo illustration for: {{newsInput}}. Ultra-realistic, dramatic lighting, editorial quality.' },
  { type: 'image', index: 1, label: 'Image 2 — Gemini Dark Drama', model: 'gemini-imagen', prompt: 'Dark, moody, dramatic editorial illustration for breaking news: {{newsInput}}. Film noir style, high contrast, digital art.' },
  { type: 'image', index: 2, label: 'Image 3 — DALL-E Bright/Warm', model: 'openai-dalle', prompt: 'Bright, warm, optimistic news photo illustration for: {{newsInput}}. Golden hour lighting, photorealistic.' },
  { type: 'image', index: 3, label: 'Image 4 — Gemini Aerial/Wide', model: 'gemini-imagen', prompt: 'Aerial perspective, wide establishing shot news illustration for: {{newsInput}}. Drone photography style, dramatic.' },
  { type: 'image', index: 4, label: 'Image 5 — DALL-E Text Overlay', model: 'openai-dalle', prompt: 'Bold news graphic with strong text overlay design for: {{newsInput}}. Clean design, impactful typography, editorial style.' },
  { type: 'image', index: 5, label: 'Image 6 — Gemini Infographic', model: 'gemini-imagen', prompt: 'News infographic card for social media about: {{newsInput}}. Clean, modern design with data visualization elements.' },
  { type: 'image', index: 6, label: 'Image 7 — DALL-E Quote Card', model: 'openai-dalle', prompt: 'Quote card news graphic for: {{newsInput}}. Minimal, elegant design with bold text on dark background.' },
  { type: 'image', index: 7, label: 'Image 8 — Gemini Breaking Banner', model: 'gemini-imagen', prompt: 'Breaking news banner graphic for: {{newsInput}}. TV news channel style, bold red and black design, urgent.' },
  { type: 'image', index: 8, label: 'Image 9 — DALL-E Portrait', model: 'openai-dalle', prompt: 'Intimate portrait-style close-up editorial photo for: {{newsInput}}. Shallow depth of field, magazine quality, expressive lighting.' },
  { type: 'image', index: 9, label: 'Image 10 — Gemini Minimalist', model: 'gemini-imagen', prompt: 'Minimalist, clean graphic design for social media. Modern aesthetic for: {{newsInput}}. Bold typography, strong color accent, generous white space.' },

  // ── Video (1) ──────────────────────────────────────────────────────────────
  { type: 'video', index: 0, label: 'Video 1 — Kling News Reel', model: 'kling', prompt: 'Create a dynamic, cinematic news video clip about: {{newsInput}}. Dramatic camera movement, broadcast quality, 5 seconds.' },
];

async function seed() {
  console.log('🌱 Seeding database...');

  // ── Admin user ─────────────────────────────────────────────────────────────
  if (config.seed.adminEmail && config.seed.adminPassword && config.seed.adminName) {
    const existing = await db.user.findUnique({ where: { email: config.seed.adminEmail } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(config.seed.adminPassword, 12);
      await db.user.create({
        data: { email: config.seed.adminEmail, passwordHash, name: config.seed.adminName, role: 'SUPER_ADMIN' },
      });
      console.log(`✅ Admin created: ${config.seed.adminEmail}`);
    } else {
      console.log(`ℹ️  Admin already exists: ${config.seed.adminEmail}`);
    }
  }

  // ── Main content template (upsert: update slots if count changed) ──────────
  const existing = await db.promptTemplate.findUnique({ where: { slug: 'default-v1' } });
  if (!existing) {
    await db.promptTemplate.create({
      data: {
        name: 'Default Template',
        slug: 'default-v1',
        version: 1,
        isActive: true,
        slots: JSON.stringify(DEFAULT_SLOTS),
      },
    });
    console.log('✅ Default template created (21 slots: 10 captions [OpenAI+Gemini], 10 images [DALL-E+Gemini], 1 video)');
  } else {
    const currentSlots = JSON.parse(existing.slots as string);
    if (currentSlots.length !== DEFAULT_SLOTS.length) {
      await db.promptTemplate.update({
        where: { slug: 'default-v1' },
        data: { slots: JSON.stringify(DEFAULT_SLOTS), version: existing.version + 1 },
      });
      console.log(`✅ Default template updated: ${currentSlots.length} → ${DEFAULT_SLOTS.length} slots (OpenAI+Gemini captions, DALL-E+Gemini images)`);
    } else {
      console.log('ℹ️  Default template already up-to-date');
    }
  }

  // ── Video Studio template (used for standalone video generation) ───────────
  const videoStudio = await db.promptTemplate.findUnique({ where: { slug: 'video-studio' } });
  if (!videoStudio) {
    await db.promptTemplate.create({
      data: {
        name: 'Video Studio',
        slug: 'video-studio',
        version: 1,
        isActive: false,
        slots: JSON.stringify([]),
      },
    });
    console.log('✅ Video Studio template created');
  } else {
    console.log('ℹ️  Video Studio template already exists');
  }

  console.log('🌱 Seeding complete!');
  await db.$disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
