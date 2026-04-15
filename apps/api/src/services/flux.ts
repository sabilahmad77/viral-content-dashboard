import { config } from '../lib/config';

export class FluxUnavailableError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'FluxUnavailableError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * FLUX.1 Pro image-to-image editing via fal.ai (FLUX.1 Kontext).
 * Activate by setting FAL_KEY in .env — no code change needed.
 * Throws FluxUnavailableError when key is missing so caller falls back to OpenAI.
 */
export async function editImageFlux(prompt: string, baseImageUrl: string): Promise<string> {
  const key = config.falKey;
  if (!key) {
    throw new FluxUnavailableError('FAL_KEY not configured — FLUX pending. Falling back to OpenAI.');
  }

  console.log(`  ⚡ [flux] Editing image via FLUX.1 Kontext (fal.ai)`);

  const res = await fetch('https://fal.run/fal-ai/flux-pro/kontext', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_url: baseImageUrl,
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: '5',
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new FluxUnavailableError(`FLUX auth failed (${res.status}) — check FAL_KEY`);
    }
    throw new Error(`FLUX generation failed (${res.status}): ${errText}`);
  }

  const data = await res.json() as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('FLUX returned no image URL');
  return url;
}

/**
 * FLUX.1 Pro text-to-image via BFL direct API (no base image).
 */
export async function generateImageFlux(prompt: string): Promise<string> {
  if (!config.bflApiKey) throw new Error('BFL_API_KEY not configured');

  const submitRes = await fetch('https://api.bfl.ml/v1/flux-pro-1.1', {
    method: 'POST',
    headers: {
      'x-key': config.bflApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Flux submission failed: ${err}`);
  }

  const { id } = await submitRes.json() as { id: string };

  // Poll for result (max 120s)
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const pollRes = await fetch(`https://api.bfl.ml/v1/get_result?id=${id}`, {
      headers: { 'x-key': config.bflApiKey },
    });
    const result = await pollRes.json() as { status: string; result?: { sample: string }; error?: string };
    if (result.status === 'Ready') return result.result!.sample;
    if (result.status === 'Error') throw new Error(`Flux error: ${result.error}`);
  }

  throw new Error('Flux generation timeout after 120s');
}
