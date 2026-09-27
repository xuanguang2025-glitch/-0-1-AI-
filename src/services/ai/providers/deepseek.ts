/**
 * DeepSeek Adapter：OpenAI 兼容协议 + appConfig 配置。
 */
import { appConfig } from '@/lib/constants/config'
import { OpenAICompatibleProvider } from './openai-compatible'

export function createDeepSeekProvider(): OpenAICompatibleProvider {
  const cfg = appConfig.ai.deepseek
  return new OpenAICompatibleProvider({
    key: 'deepseek',
    displayName: 'DeepSeek',
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    defaultModel: cfg.model,
  })
}
