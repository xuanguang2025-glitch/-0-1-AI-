/**
 * Ollama 本地模型 Adapter：OpenAI 兼容端点（/v1）。
 */
import { appConfig } from '@/lib/constants/config'
import { OpenAICompatibleProvider } from './openai-compatible'

export function createOllamaProvider(): OpenAICompatibleProvider {
  const cfg = appConfig.ai.ollama
  return new OpenAICompatibleProvider({
    key: 'ollama',
    displayName: 'Ollama (Local)',
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    defaultModel: cfg.model,
  })
}
