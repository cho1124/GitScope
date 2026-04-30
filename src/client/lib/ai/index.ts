// Theme AI provider 레지스트리.
// 새 provider(예: openai, gemini)는 여기에 등록만 하면 SettingsModal 자동 노출.

import type { ThemeAiProvider } from './types'
import { AnthropicThemeProvider } from './anthropic'
import { LocalLlamaThemeProvider } from './local'

export * from './types'
export * from './validation'
export {
  ANTHROPIC_API_KEY_STORAGE,
  ANTHROPIC_MODEL_STORAGE,
  ANTHROPIC_DEFAULT_MODEL,
  ANTHROPIC_MODEL_OPTIONS,
} from './anthropic'

const PROVIDERS: ThemeAiProvider[] = [
  new LocalLlamaThemeProvider(), // 1차 방향 — 사용 가능 시 우선
  new AnthropicThemeProvider(),  // BYOK fallback
]

export function listProviders(): ThemeAiProvider[] {
  return PROVIDERS
}

export function getProvider(id: string): ThemeAiProvider | undefined {
  return PROVIDERS.find(p => p.id === id)
}

const SELECTED_STORAGE = 'gitscope.themeAiProvider'

export function getSelectedProviderId(): string {
  const saved = localStorage.getItem(SELECTED_STORAGE)
  if (saved && PROVIDERS.some(p => p.id === saved)) return saved
  // 기본값: anthropic (BYOK 만 동작 가능한 현 시점). 11-B 이후 'local-llama'로 default 전환 검토.
  return 'anthropic'
}

export function setSelectedProviderId(id: string): void {
  localStorage.setItem(SELECTED_STORAGE, id)
}
