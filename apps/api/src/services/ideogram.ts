import { config } from '../lib/config';

export async function generateImageIdeogram(prompt: string): Promise<string> {
  if (!config.ideogramApiKey) throw new Error('IDEOGRAM_API_KEY not configured');

  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Api-Key': config.ideogramApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_request: { prompt, model: 'V_2', aspect_ratio: 'ASPECT_1_1' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ideogram failed: ${err}`);
  }

  const data = await res.json() as { data: Array<{ url: string }> };
  return data.data[0].url;
}
