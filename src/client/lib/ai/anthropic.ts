import Anthropic from '@anthropic-ai/sdk'
import {
  TOKEN_KEYS, type ThemePalette, type ThemeAiProvider,
  type GenerateOptions, type RefineOptions, type ProviderAvailability,
} from './types'
import { validatePaletteShape } from './validation'

const API_KEY_STORAGE = 'gitscope.anthropicApiKey'
const MODEL_STORAGE = 'gitscope.themeGenModel'
const DEFAULT_MODEL = 'claude-opus-4-7'

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

const REFINE_SYSTEM_PROMPT = `You are a UI theme editor. Apply the user's instruction to the BASE palette and return the FULL modified 14-token palette in the same schema. Output ONLY the JSON. No prose.

Preserve every token even if not affected. Same constraints as generation: hex format, WCAG AA, dark or light (not mid-tone), distinct semantics.`

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    tokens: {
      type: 'object',
      properties: Object.fromEntries(TOKEN_KEYS.map(k => [k, { type: 'string' }])),
      required: [...TOKEN_KEYS],
      additionalProperties: false,
    },
  },
  required: ['name', 'tokens'],
  additionalProperties: false,
}

export interface AnthropicProviderOptions {
  /** 명시적 키 — 미지정 시 localStorage 의 'gitscope.anthropicApiKey' */
  apiKey?: string
  /** 명시적 모델 — 미지정 시 localStorage 또는 default */
  model?: string
}

function readKey(opts?: AnthropicProviderOptions): string {
  return opts?.apiKey ?? localStorage.getItem(API_KEY_STORAGE) ?? ''
}

function readModel(opts?: AnthropicProviderOptions): string {
  return opts?.model ?? localStorage.getItem(MODEL_STORAGE) ?? DEFAULT_MODEL
}

function buildClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    // Tauri WebView (사용자 본인 키, 데스크톱 BYOK)
    dangerouslyAllowBrowser: true,
  })
}

function extractJsonFromResponse(content: Anthropic.ContentBlock[]): unknown {
  const textBlock = content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('응답이 비어있습니다')
  }
  try {
    return JSON.parse(textBlock.text)
  } catch {
    throw new Error(`JSON 파싱 실패: ${textBlock.text.slice(0, 100)}`)
  }
}

export class AnthropicThemeProvider implements ThemeAiProvider {
  readonly id = 'anthropic'
  readonly label = 'Anthropic Claude (BYOK)'
  readonly description = 'console.anthropic.com API 키로 직접 호출'

  constructor(private opts: AnthropicProviderOptions = {}) {}

  async isAvailable(): Promise<ProviderAvailability> {
    const key = readKey(this.opts).trim()
    if (!key) return { ok: false, reason: 'API 키 미입력' }
    if (!key.startsWith('sk-ant-')) return { ok: false, reason: 'API 키 형식이 sk-ant-로 시작하지 않습니다' }
    return { ok: true }
  }

  async generate({ prompt, model: modelOverride }: GenerateOptions): Promise<ThemePalette> {
    const key = readKey(this.opts).trim()
    if (!key) throw new Error('Anthropic API 키가 필요합니다')
    const model = modelOverride ?? readModel(this.opts)

    const response = await buildClient(key).messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        format: { type: 'json_schema', schema: SCHEMA },
      },
    })

    return validatePaletteShape(extractJsonFromResponse(response.content))
  }

  async refine({ base, instruction, model: modelOverride }: RefineOptions): Promise<ThemePalette> {
    const key = readKey(this.opts).trim()
    if (!key) throw new Error('Anthropic API 키가 필요합니다')
    const model = modelOverride ?? readModel(this.opts)

    const userMessage = `BASE PALETTE:
${JSON.stringify(base, null, 2)}

INSTRUCTION: ${instruction}

Return the modified full 14-token palette as JSON.`

    const response = await buildClient(key).messages.create({
      model,
      max_tokens: 1024,
      system: REFINE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      output_config: {
        format: { type: 'json_schema', schema: SCHEMA },
      },
    })

    return validatePaletteShape(extractJsonFromResponse(response.content))
  }
}

export const ANTHROPIC_API_KEY_STORAGE = API_KEY_STORAGE
export const ANTHROPIC_MODEL_STORAGE = MODEL_STORAGE
export const ANTHROPIC_DEFAULT_MODEL = DEFAULT_MODEL

export const ANTHROPIC_MODEL_OPTIONS = [
  { id: 'claude-opus-4-7', label: 'Opus 4.7 (가장 높은 품질, $5/$25 per 1M)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (밸런스, $3/$15)' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 (가장 빠르고 저렴, $1/$5)' },
]
