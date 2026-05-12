import { useEffect, useState } from 'react'

// ── 배경 데코 설정 ────────────────────────────────────────
//
// 디자인 원칙:
// - 기본 OFF (방해 없도록)
// - 모든 값은 localStorage 영속, custom event 로 reactive
// - 향후 Phase 11-D-2 에서 AI 가 자연어로 같은 DecorConfig 를 생성

export type IconSet = 'git' | 'code' | 'minimal' | 'fun' | 'custom' | 'none'
export type SpeedLevel = 'slow' | 'medium' | 'fast'
export type ColorSource = 'auto' | 'accent' | 'mauve' | 'green' | 'peach' | 'yellow' | 'red'
export type DriftMode = 'all' | 'up' | 'down'

export interface DecorConfig {
  enabled: boolean
  iconSet: IconSet
  /** 화면 위에 동시에 보이는 아이콘 개수 (5~30) */
  density: number
  speed: SpeedLevel
  /** 0.03 ~ 0.30 */
  opacity: number
  /** 아이콘 픽셀 사이즈 (12 ~ 36) */
  size: number
  color: ColorSource
  drift: DriftMode
  /** iconSet='custom' 일 때 사용할 lucide 아이콘 이름들 (PascalCase, 예: ['Cat', 'PawPrint']) */
  customIcons: string[]
}

export const DEFAULT_DECOR_CONFIG: DecorConfig = {
  enabled: false,
  iconSet: 'git',
  density: 12,
  speed: 'slow',
  opacity: 0.08,
  size: 18,
  color: 'auto',
  drift: 'all',
  customIcons: [],
}

export const DENSITY_MIN = 5
export const DENSITY_MAX = 30
export const OPACITY_MIN = 0.03
export const OPACITY_MAX = 0.30
export const SIZE_MIN = 12
export const SIZE_MAX = 36

const LS_KEY = 'pepper.decor'
const EVENT = 'pepper:decor-changed'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function sanitize(raw: Partial<DecorConfig> | null): DecorConfig {
  if (!raw) return { ...DEFAULT_DECOR_CONFIG }
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_DECOR_CONFIG.enabled,
    iconSet: (['git', 'code', 'minimal', 'fun', 'custom', 'none'] as IconSet[]).includes(raw.iconSet as IconSet)
      ? (raw.iconSet as IconSet)
      : DEFAULT_DECOR_CONFIG.iconSet,
    density: Number.isFinite(raw.density)
      ? clamp(Math.round(raw.density as number), DENSITY_MIN, DENSITY_MAX)
      : DEFAULT_DECOR_CONFIG.density,
    speed: (['slow', 'medium', 'fast'] as SpeedLevel[]).includes(raw.speed as SpeedLevel)
      ? (raw.speed as SpeedLevel)
      : DEFAULT_DECOR_CONFIG.speed,
    opacity: Number.isFinite(raw.opacity)
      ? clamp(raw.opacity as number, OPACITY_MIN, OPACITY_MAX)
      : DEFAULT_DECOR_CONFIG.opacity,
    size: Number.isFinite(raw.size)
      ? clamp(Math.round(raw.size as number), SIZE_MIN, SIZE_MAX)
      : DEFAULT_DECOR_CONFIG.size,
    color: (['auto', 'accent', 'mauve', 'green', 'peach', 'yellow', 'red'] as ColorSource[]).includes(raw.color as ColorSource)
      ? (raw.color as ColorSource)
      : DEFAULT_DECOR_CONFIG.color,
    drift: (['all', 'up', 'down'] as DriftMode[]).includes(raw.drift as DriftMode)
      ? (raw.drift as DriftMode)
      : DEFAULT_DECOR_CONFIG.drift,
    customIcons: Array.isArray(raw.customIcons)
      ? raw.customIcons.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 30)
      : [],
  }
}

export function getDecorConfig(): DecorConfig {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_DECOR_CONFIG }
    return sanitize(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_DECOR_CONFIG }
  }
}

export function setDecorConfig(next: Partial<DecorConfig>): void {
  const current = getDecorConfig()
  const merged = sanitize({ ...current, ...next })
  try { localStorage.setItem(LS_KEY, JSON.stringify(merged)) } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: merged }))
}

export function useDecorConfig(): DecorConfig {
  const [cfg, setCfg] = useState<DecorConfig>(getDecorConfig)
  useEffect(() => {
    const handler = () => setCfg(getDecorConfig())
    window.addEventListener(EVENT, handler)
    const storageHandler = (e: StorageEvent) => {
      if (e.key === LS_KEY) setCfg(getDecorConfig())
    }
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener(EVENT, handler)
      window.removeEventListener('storage', storageHandler)
    }
  }, [])
  return cfg
}

// ── 색상 매핑 (CSS var 키로) ──────────────────────────────
export function resolveColorVar(c: ColorSource): string {
  switch (c) {
    case 'auto': return 'var(--accent)'
    case 'accent': return 'var(--accent)'
    case 'mauve': return 'var(--mauve)'
    case 'green': return 'var(--green)'
    case 'peach': return 'var(--peach)'
    case 'yellow': return 'var(--yellow)'
    case 'red': return 'var(--red)'
  }
}

export function speedToDurationSec(s: SpeedLevel): [number, number] {
  // [min, max] 초 — 각 입자는 이 범위 안에서 랜덤
  switch (s) {
    case 'slow': return [60, 120]
    case 'medium': return [25, 50]
    case 'fast': return [10, 20]
  }
}