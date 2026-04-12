import { config } from '../lib/config';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
