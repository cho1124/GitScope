import { TOKEN_KEYS, SEMANTIC_TOKENS, type TokenKey, type TokenMap, type ThemePalette } from './types'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

// ─── 기본 색 변환 ───────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

/** WCAG 정의 상대 루미넌스 (0=검정, 1=흰색) */
export function relativeLuminance(hex: string): number {
  const [R, G, B] = hexToRgb(hex)
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(R) + 0.7152 * lin(G) + 0.0722 * lin(B)
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** RGB → HSL hue (0~360 도). 채도 0이면 0 반환. */
export function hexToHue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

/** 두 hue 사이 짧은 거리 (0~180). 360°를 원으로 본다. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

// ─── 팔레트 검증 ─────────────────────────────────

/**
 * 형식 강제 — 14개 토큰 누락 / hex 형식 위반은 throw.
 * AI 응답 직후 호출.
 */
export function validatePaletteShape(data: unknown): ThemePalette {
  if (!data || typeof data !== 'object') throw new Error('객체가 아닙니다')
  const obj = data as Record<string, unknown>

  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    throw new Error('name 필드 누락 또는 빈 문자열')
  }
  if (!obj.tokens || typeof obj.tokens !== 'object') {
    throw new Error('tokens 필드가 객체 아님')
  }

  const tokens = obj.tokens as Record<string, unknown>
  const out: Partial<TokenMap> = {}
  for (const key of TOKEN_KEYS) {
    const v = tokens[key]
    if (typeof v !== 'string') throw new Error(`토큰 ${key} 누락`)
    if (!HEX_RE.test(v)) throw new Error(`토큰 ${key} hex 형식 위반: ${v}`)
    out[key] = v.toLowerCase()
  }

  return { name: obj.name.trim(), tokens: out as TokenMap }
}

export interface PaletteWarning {
  severity: 'warn' | 'info'
  /** 어떤 토큰 관련인지 (UI 강조용) — 단일 또는 페어 */
  tokens: TokenKey[]
  message: string
}

/**
 * 품질 검사 — throw 안 하고 경고 목록 반환.
 * AI 생성 직후 + 수동 편집 중 실시간 표시 가능.
 */
export function auditPalette(palette: ThemePalette): PaletteWarning[] {
  const warnings: PaletteWarning[] = []
  const t = palette.tokens

  // 1. WCAG AA contrast — text-primary on bg-primary 4.5:1
  const cTextBg = contrastRatio(t['text-primary'], t['bg-primary'])
  if (cTextBg < 4.5) {
    warnings.push({
      severity: 'warn',
      tokens: ['text-primary', 'bg-primary'],
      message: `text-primary / bg-primary 대비비 ${cTextBg.toFixed(2)}:1 (WCAG AA 4.5 미달)`,
    })
  }
  const cSecondary = contrastRatio(t['text-secondary'], t['bg-primary'])
  if (cSecondary < 3.0) {
    warnings.push({
      severity: 'warn',
      tokens: ['text-secondary', 'bg-primary'],
      message: `text-secondary / bg-primary 대비비 ${cSecondary.toFixed(2)}:1 (3.0 미달)`,
    })
  }
  const cAccent = contrastRatio(t['accent'], t['bg-primary'])
  if (cAccent < 3.0) {
    warnings.push({
      severity: 'warn',
      tokens: ['accent', 'bg-primary'],
      message: `accent / bg-primary 대비비 ${cAccent.toFixed(2)}:1 (3.0 미달, 강조 가시성 낮음)`,
    })
  }

  // 2. Luminance band — bg-primary 풀 다크(<0.2) 또는 풀 라이트(>0.8) 권장
  const bgL = relativeLuminance(t['bg-primary'])
  if (bgL >= 0.2 && bgL <= 0.8) {
    warnings.push({
      severity: 'warn',
      tokens: ['bg-primary'],
      message: `bg-primary 루미넌스 ${bgL.toFixed(2)} — 중간 톤 (권장: <0.2 또는 >0.8)`,
    })
  }

  // 3. 의미 색 hue 분리 — 30° 이상 떨어져야 식별 가능
  for (let i = 0; i < SEMANTIC_TOKENS.length; i++) {
    for (let j = i + 1; j < SEMANTIC_TOKENS.length; j++) {
      const a = SEMANTIC_TOKENS[i]
      const b = SEMANTIC_TOKENS[j]
      const ha = hexToHue(t[a])
      const hb = hexToHue(t[b])
      const dist = hueDistance(ha, hb)
      if (dist < 30) {
        warnings.push({
          severity: 'warn',
          tokens: [a, b],
          message: `${a} / ${b} hue 차이 ${dist.toFixed(0)}° (30° 미만 — 시각적 구분 어려움)`,
        })
      }
    }
  }

  // 4. bg-* 단계 — bg-primary < bg-secondary < bg-surface 가 일반적이지만 강제 X (라이트 테마는 반대)
  // 단순히 모두 같으면 경고
  const bgs = ['bg-primary', 'bg-secondary', 'bg-surface', 'bg-hover'] as const
  const uniqBgs = new Set(bgs.map(k => t[k]))
  if (uniqBgs.size < 3) {
    warnings.push({
      severity: 'info',
      tokens: [...bgs],
      message: `배경 4단계 중 ${uniqBgs.size}개만 고유 — 계층 구분 약함`,
    })
  }

  return warnings
}

export const HEX_REGEX = HEX_RE
