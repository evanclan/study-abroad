import Anthropic from '@anthropic-ai/sdk';

// Sonnet 4.5 is the production reasoning model for this app. Centralising the
// model name here means we tune cost/quality in one place.
export const CLAUDE_MODEL = 'claude-sonnet-4-5';

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env.local before running the quote engine.',
    );
  }
  cached = new Anthropic({ apiKey });
  return cached;
}
