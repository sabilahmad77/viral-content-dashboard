import Anthropic from '@anthropic-ai/sdk';
import { config } from '../lib/config';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

export async function generateCaptionAnthropic(prompt: { system: string; user: string }): Promise<string> {
  const res = await getClient().messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });
  return (res.content[0] as { text: string }).text;
}
