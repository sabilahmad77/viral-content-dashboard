/**
 * Provider sequence for image slot assignment.
 * Slots are assigned in repeating groups of 3:
 *   Slots 0-2  → Gemini
 *   Slots 3-5  → OpenAI
 *   Slots 6-8  → FLUX
 *   Slots 9-11 → Gemini (cycle)
 *   ...etc up to 20 images
 */
export type ImageProvider = 'gemini-imagen' | 'openai-dalle' | 'flux';

export function getProviderForImageSlot(slotIndex: number): ImageProvider {
  const group = Math.floor(slotIndex / 3) % 3;
  if (group === 0) return 'gemini-imagen';
  if (group === 1) return 'openai-dalle';
  return 'flux';
}
