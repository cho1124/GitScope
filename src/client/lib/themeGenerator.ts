import Anthropic from '@anthropic-ai/sdk'

// Catppuccin 토큰 14개 — 이 순서/이름은 global.css 변수와 정확히 매칭되어야 함
export const TOKEN_KEYS = [
  'bg-primary', 'bg-secondary', 'bg-surface', 'bg-hover',
  'text-primary', 'text-secondary', 'text-muted',
  'border', 'accent', 'green', 'yellow', 'peach', 'red', 'mauve',
] as const

export type TokenKey = typeof TOKEN_KEYS[number]
export type TokenMap = Record<TokenKey, string>

export interface ThemePalette {
  name: string
  tokens: TokenMap
}

const SYSTEM_PROMPT = `You are a UI theme designer for GitScope, a Git GUI desktop app.

Generate a Catppuccin-style 14-token palette based on the user's description. Output ONLY the JSON matching the schema. No prose.

GUIDELINES:
- Choose either fully dark (bg-primary luminance < 0.2) OR fully light (bg-primary luminance > 0.8). Never mid-tone.
- text-primary on bg-primary must reach WCAG AA contrast (≥ 4.5:1).
- accent / green / yellow / red / peach / mauve must be visually distinct semantic colors (>30° hue apart).
- bg-secondary slightly differs from bg-primary (sidebar/header).
- bg-surface for cards/dropdowns (between secondary and hover).
- bg-hover slightly different from secondary (subtle change for hover state).
- border subtle (low contrast vs bg-primary, but visible).
- All hex values are #RRGGBB (7 chars, lowercase OK).
- "name" is 1-3 words capturing the theme vibe.`

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    tokens: {
      type: 'object',
      properties: Object.fromEntries(
        TOKEN_KEYS.map(k => [k, { type: 'string' }])
      ),
      required: [...TOKEN_KEYS],
      additionalProperties: false,
    },
  },
  required: ['name', 'tokens'],
  additionalProperties: false,
}

export interface GenerateOptions {
  apiKey: string
  prompt: string
  /** 기본 claude-opus-4-7. claude-haiku-4-5 / claude-sonnet-4-6 등 */
  model?: string
}

/**
 * 사용자 프롬프트로 Catppuccin 호환 14개 토큰 팔레트를 생성한다.
 * Anthropic SDK structured outputs (output_config.format json_schema) 사용.
 */
export async function generateTheme(opts: GenerateOptions): Promise<ThemePalette> {
  const client = new Anthropic({
    apiKey: opts.apiKey,
    // Tauri WebView (사용자 본인 키, 데스크톱 앱) — BYOK 패턴이라 OK
    dangerouslyAllowBrowser: true,
  })

  const response = await client.messages.create({
    model: opts.model ?? 'claude-opus-4-7',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: opts.prompt }],
    output_config: {
      format: { type: 'json_schema', schema: SCHEMA },
    },
  })

  // structured output → 단일 텍스트 블록에 JSON
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('테마 생성 응답이 비어있습니다')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(textBlock.text)
  } catch (e) {
    throw new Error(`JSON 파싱 실패: ${textBlock.text.slice(0, 100)}`)
  }

  return validatePalette(parsed)
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function validatePalette(data: unknown): ThemePalette {
  if (!data || typeof data !== 'object') throw new Error('객체가 아닙니다')
  const obj = data as Record<string, unknown>

  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    throw new Error('name 필드가 없거나 빈 문자열입니다')
  }
  if (!obj.tokens || typeof obj.tokens !== 'object') {
    throw new Error('tokens 필드가 객체가 아닙니다')
  }

  const tokens = obj.tokens as Record<string, unknown>
  const out: Partial<TokenMap> = {}
  for (const key of TOKEN_KEYS) {
    const v = tokens[key]
    if (typeof v !== 'string') {
      throw new Error(`토큰 ${key} 누락 또는 문자열 아님`)
    }
    if (!HEX_RE.test(v)) {
      throw new Error(`토큰 ${key} 가 유효한 hex 형식 아님: ${v}`)
    }
    out[key] = v.toLowerCase()
  }

  return {
    name: obj.name.trim(),
    tokens: out as TokenMap,
  }
}

/**
 * #RRGGBB → 상대 루미넌스 (WCAG 정의). 0=검정, 1=흰색.
 * 백그라운드/텍스트 대비비 계산용.
 */
export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}
