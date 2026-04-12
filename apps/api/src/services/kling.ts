import { config } from '../lib/config';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollKlingTask(taskId: string): Promise<string> {
  if (!config.klingApiKey) throw new Error('KLING_API_KEY not configured');

  for (let i = 0; i < 150; i++) {
    await sleep(4000);
    const res = await fetch(`https://api.klingai.com/v1/videos/text2video/${taskId}`, {
      headers: { Authorization: `Bearer ${config.klingApiKey}` },
    });
    const data = await res.json() as {
      data: { task_status: string; task_result?: { videos: Array<{ url: string }> } };
    };

    const status = data.data.task_status;
    if (status === 'succeed') {
      return data.data.task_result!.videos[0].url;
    }
    if (status === 'failed') throw new Error('Kling video generation failed');
  }

  throw new Error('Kling generation timeout after 10 minutes');
}

export async function generateVideoKling(prompt: string, imageUrl?: string): Promise<string> {
  if (!config.klingApiKey) throw new Error('KLING_API_KEY not configured');

  const body: Record<string, unknown> = {
    model_name: 'kling-v1-5',
    prompt,
    duration: '5',
    mode: 'std',
  };
  if (imageUrl) body.image = imageUrl;

  const res = await fetch('https://api.klingai.com/v1/videos/text2video', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.klingApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kling submission failed: ${err}`);
  }

  const data = await res.json() as { data: { task_id: string } };
  return await pollKlingTask(data.data.task_id);
}
