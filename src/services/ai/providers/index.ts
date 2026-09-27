/**
 * Provider 注册表：providerKey → AiProvider 单例。
 */
import { appConfig } from '@/lib/constants/config'
import { createDeepSeekProvider } from './deepseek'
import { createOllamaProvider } from './ollama'
import { MockProvider } from './mock'
import { OpenAICompatibleProvider } from './openai-compatible'
import type { AiProvider } from '../types'

const globalForProviders = globalThis as unknown as { __aiProviders?: Map<string, AiProvider> }

function buildRegistry(): Map<string, AiProvider> {
  const map = new Map<string, AiProvider>()
  map.set('deepseek', createDeepSeekProvider())
  map.set('openai', new OpenAICompatibleProvider({
    key: 'openai',
    displayName: 'OpenAI',
    baseUrl: appConfig.ai.openai.baseUrl,
    apiKey: appConfig.ai.openai.apiKey,
    defaultModel: appConfig.ai.openai.model,
  }))
  map.set('ollama', createOllamaProvider())
  map.set('mock', new MockProvider())
  return map
}

const providers: Map<string, AiProvider> = globalForProviders.__aiProviders ?? buildRegistry()
globalForProviders.__aiProviders = providers

/** 取 provider；未知 key 回退 mock（永不 throw） */
export function getProvider(providerKey: string): AiProvider {
  return providers.get(providerKey) ?? providers.get('mock')!
}

/** 当前默认 providerKey（env 决定） */
export function defaultProviderKey(): string {
  return appConfig.ai.provider
}

/** failover providerKey */
export function failoverProviderKey(): string {
  return appConfig.ai.failoverProvider
}
