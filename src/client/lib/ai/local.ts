import { api } from '../../api'
import {
  TOKEN_KEYS, type ThemeAiProvider, type ProviderAvailability,
  type GenerateOptions, type RefineOptions, type ThemePalette,
} from './types'
import { validatePaletteShape } from './validation'

const SELECTED_MODEL_STORAGE = 'gitscope.localAiModel'
export const LOCAL_DEFAULT_MODEL = 'qwen2.5-coder-3b-q4'

export function getSelectedLocalModel(): string {
  return localStorage.getItem(SELECTED_MODEL_STORAGE) ?? LOCAL_DEFAULT_MODEL
}

export function setSelectedLocalModel(id: string): void {
  localStorage.setItem(SELECTED_MODEL_STORAGE, id)
}

const SYSTEM_PROMPT = `You are a UI theme designer for GitScope, a Git GUI desktop app.

Generate a Catppuccin-style 14-token palette. Output ONLY a JSON object with the schema:
{
  "name": string (1-3 words capturing the theme vibe),
  "tokens": {
    ${TOKEN_KEYS.map(k => `"${k}": "#RRGGBB"`).join(',\n    ')}
  }
}

GUIDELINES:
- Choose either fully dark (bg-primary lightness < 0.2) OR fully light (> 0.8). Never mid-tone.
- text-primary on bg-primary must reach WCAG AA contrast (>= 4.5:1).
- accent / green / yellow / red / peach / mauve must be visually distinct semantic colors (>30 degree hue apart).
- bg-secondary slightly differs from bg-primary (sidebar/header).
- bg-surface for cards/dropdowns (between secondary and hover).
- bg-hover slightly different from secondary.
- border subtle (low contrast vs bg-primary, but visible).
- All hex values are #RRGGBB (7 chars, lowercase OK).
- No prose, no markdown fences, only the JSON.`

const REFINE_SYSTEM_PROMPT = `You are a UI theme editor. Apply the user's instruction to the BASE palette and return the FULL modified 14-token palette in the same schema. Output ONLY the JSON. No prose. No markdown fences.

Preserve every token even if not affected. Same constraints as generation: hex format, WCAG AA, dark or light (not mid-tone), distinct semantics.`

interface ChatCompletionResponse {
  choices: Array<{
    message: { role: string; content: string }
    finish_reason?: string
  }>
}

/**
 * llama-server 가 OpenAI compatible 이라 fetch 로 직접 호출.
 * 응답에서 JSON 본문 추출 → 검증.
 */
async function callLocal(port: number, system: string, user: string): Promise<ThemePalette> {
  const url = `http://127.0.0.1:${port}/v1/chat/completions`
  const body = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1024,
    temperature: 0.7,
    stream: false,
  }
  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new Error(`로컬 서버 호출 실패 (port ${port}): ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`)
  }
  const data = (await resp.json()) as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) throw new Error('빈 응답')

  // 일부 모델은 ```json ... ``` 로 감싸므로 안전하게 추출
  const jsonText = extractJsonBlock(content)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (e) {
    throw new Error(`JSON 파싱 실패: ${jsonText.slice(0, 200)}`)
  }
  return validatePaletteShape(parsed)
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  // 첫 { 부터 마지막 } 까지
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) return text.slice(first, last + 1)
  return text.trim()
}

/**
 * 모델/서버 준비 후 호출. 매 generate 호출 시 ai_start_server 를 부르되,
 * 같은 모델이 이미 실행 중이면 backend 가 즉시 기존 포트를 반환.
 */
async function ensureServer(modelId: string): Promise<number> {
  const r = await api.aiStartServer(modelId)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

export class LocalLlamaThemeProvider implements ThemeAiProvider {
  readonly id = 'local-llama'
  readonly label = '로컬 디자인 엔진 (llama.cpp)'
  readonly description = 'GitScope 내장 — 외부 API 키 불필요, 첫 사용 시 모델 다운로드 (~1~2GB)'

  async isAvailable(): Promise<ProviderAvailability> {
    const r = await api.aiStatus()
    if (!r.ok) return { ok: false, reason: `상태 조회 실패: ${r.error}` }
    const status = r.data
    if (!status.serverInstalled) {
      return { ok: false, reason: '추론 엔진(llama-server) 미설치 — 설정창에서 다운로드' }
    }
    const selected = getSelectedLocalModel()
    const model = status.models.find(m => m.id === selected)
    if (!model || !model.installed) {
      return { ok: false, reason: '선택한 모델 미설치 — 설정창에서 다운로드' }
    }
    return { ok: true }
  }

  async generate({ prompt }: GenerateOptions): Promise<ThemePalette> {
    const modelId = getSelectedLocalModel()
    const port = await ensureServer(modelId)
    return callLocal(port, SYSTEM_PROMPT, prompt)
  }

  async refine({ base, instruction }: RefineOptions): Promise<ThemePalette> {
    const modelId = getSelectedLocalModel()
    const port = await ensureServer(modelId)
    const user = `BASE PALETTE:\n${JSON.stringify(base, null, 2)}\n\nINSTRUCTION: ${instruction}\n\nReturn the modified full 14-token palette as JSON.`
    return callLocal(port, REFINE_SYSTEM_PROMPT, user)
  }
}