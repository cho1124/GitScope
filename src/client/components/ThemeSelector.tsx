// 이전엔 React 컴포넌트 ThemeSelector 가 있었지만 SettingsModal 통합 후 미사용 → 제거됨.
// 모듈 이름은 유지(임포트 호환).
import { TOKEN_KEYS, type TokenMap } from '../lib/ai'

export type BuiltinTheme = 'mocha' | 'latte' | 'frappe' | 'macchiato'

/** custom 테마는 'custom-' prefix + 임의 ID. */
export type Theme = BuiltinTheme | string

export const builtinThemes: { id: BuiltinTheme; label: string; preview: string }[] = [
  { id: 'mocha', label: 'Mocha', preview: '#1e1e2e' },
  { id: 'latte', label: 'Latte', preview: '#eff1f5' },
  { id: 'frappe', label: 'Frappé', preview: '#303446' },
  { id: 'macchiato', label: 'Macchiato', preview: '#24273a' },
]

const STORAGE_KEY = 'pepper.theme'
const CUSTOM_STORAGE_KEY = 'pepper.customThemes'

function isBuiltinTheme(v: unknown): v is BuiltinTheme {
  return v === 'mocha' || v === 'latte' || v === 'frappe' || v === 'macchiato'
}

export interface CustomTheme {
  id: string  // 'custom-<uuid>'
  name: string
  tokens: TokenMap
  createdAt: string  // ISO 8601
}

export function getCustomThemes(): CustomTheme[] {
  const raw = localStorage.getItem(CUSTOM_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomTheme(theme: CustomTheme): void {
  const list = getCustomThemes().filter(t => t.id !== theme.id)
  list.unshift(theme)
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list))
}

export function deleteCustomTheme(id: string): void {
  const list = getCustomThemes().filter(t => t.id !== id)
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list))
}

export function getSavedTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY) ?? 'mocha'
  // custom ID도 그대로 통과시키되, 존재 여부는 applyTheme 시점에 확인
  return saved
}

export function applyTheme(themeId: Theme): void {
  if (isBuiltinTheme(themeId)) {
    document.documentElement.setAttribute('data-theme', themeId)
    // 이전 custom 인라인 스타일 제거
    for (const k of TOKEN_KEYS) {
      document.documentElement.style.removeProperty(`--${k}`)
    }
    localStorage.setItem(STORAGE_KEY, themeId)
    return
  }
  // custom theme — 저장된 토큰을 인라인으로 설정
  const custom = getCustomThemes().find(t => t.id === themeId)
  if (!custom) {
    // 저장 안 된 ID라면 기본 mocha로 복귀
    applyTheme('mocha')
    return
  }
  document.documentElement.removeAttribute('data-theme')
  for (const [k, v] of Object.entries(custom.tokens)) {
    document.documentElement.style.setProperty(`--${k}`, v)
  }
  localStorage.setItem(STORAGE_KEY, themeId)
}
