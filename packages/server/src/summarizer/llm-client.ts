import { LlmConfig } from '@agent-feeds/shared';

export async function chatCompletion(
  _config: LlmConfig,
  _systemPrompt: string,
  _userMessage: string
): Promise<string> {
  throw new Error('LLM summarization not available in MVP');
}
