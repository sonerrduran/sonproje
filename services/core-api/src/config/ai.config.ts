import { registerAs } from '@nestjs/config';
export const aiConfig = registerAs('ai', () => ({
  geminiApiKey: process.env.GEMINI_API_KEY,
  maxTokensPerRequest: parseInt(process.env.AI_MAX_TOKENS ?? '2048', 10),
}));
