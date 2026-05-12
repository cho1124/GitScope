import { api } from '../../api'
import {
  TOKEN_KEYS, type ThemeAiProvider, type ProviderAvailability,
  type GenerateOptions, type RefineOptions, type ThemePalette,
} from './types'
import { validatePaletteShape, validateDecorShape } from './validation'
import type { DecorConfig } from '../decorSettings'

const SELECTED_MODEL_STORAGE = 'pepper.localAiModel'
export const LOCAL_DEFAULT_MODEL = 'qwen2.5-coder-3b-q4'

export function getSelectedLocalModel(): string {
  return localStorage.getItem(SELECTED_MODEL_STORAGE) ?? LOCAL_DEFAULT_MODEL
}

export function setSelectedLocalModel(id: string): void {
  localStorage.setItem(SELECTED_MODEL_STORAGE, id)
}

const SYSTEM_PROMPT = `You are a UI theme designer for Pepper, a Git GUI desktop app.

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

const DECOR_SYSTEM_PROMPT = `You design Pepper's animated background decoration based on a user's mood/instruction.

Output ONLY a JSON object with this exact schema (no prose, no markdown fences):
{
  "enabled": true,
  "iconSet": "git" | "code" | "minimal" | "fun" | "custom" | "none",
  "density": integer 5-30 (number of icons on screen at once),
  "speed": "slow" | "medium" | "fast",
  "opacity": number 0.03-0.30,
  "size": integer 12-36 (icon pixel size),
  "color": "auto" | "accent" | "mauve" | "green" | "peach" | "yellow" | "red",
  "drift": "all" | "up" | "down",
  "customIcons": string[] (only when iconSet="custom", PascalCase lucide icon names)
}

ICON SETS:
- "git": GitBranch, GitCommit, GitMerge, Cherry, Tag (git, branches, version control)
- "code": Code, Braces, Terminal, Cpu, Binary, Bug (programming, hacker, matrix)
- "minimal": Circle, Square, Triangle (calm, abstract, geometric, zen)
- "fun": Cat, Dog, Bird, Fish, Rabbit, Squirrel, Turtle, PawPrint, Sun, Moon, Heart, Coffee, Sparkles, Leaf, Cloud, Flame
  (cute, playful, animal/nature themes, "things floating around")
- "custom": user wants ONLY specific icons → set customIcons to a list of names
- "none": empty background

CUSTOM ICON NAMES (PascalCase, use these EXACT names in customIcons):
  GitBranch, GitCommit, GitMerge, GitPullRequest, GitFork, Tag, Cherry, Code2,
  Code, Braces, Terminal, FileCode, Cpu, Binary, Hash, Bug,
  Circle, Square, Triangle, Diamond, Hexagon, Star,
  Cat, Dog, Bird, Fish, Rabbit, Squirrel, Turtle, PawPrint,
  Sun, Moon, Cloud, Flame, Sparkles, Heart, Coffee, Leaf

EXAMPLES:
- "고양이가 떠다니는 배경" / "cats floating" → iconSet="custom", customIcons=["Cat", "PawPrint"]
- "고양이만" / "only cats" → iconSet="custom", customIcons=["Cat"]
- "강아지 산책" → iconSet="custom", customIcons=["Dog", "PawPrint"]
- "동물 친구들" / "cute animals" → iconSet="fun"
- "별이 빛나는 밤" / "starry sky" → iconSet="custom", customIcons=["Star", "Moon", "Sparkles"]
- "코드 매트릭스" / "code rain" → iconSet="code", drift="down", speed="medium"

GUIDELINES:
- "calm / subtle / zen" → minimal or git, density 6-10, speed slow, opacity 0.04-0.08, size 14-20
- "energetic / active / busy" → density 20-30, speed medium/fast, opacity 0.10-0.18
- "matrix / hacker / code rain" → code icons, drift "down", speed medium, density 20+
- "rising / hopeful / float up" → drift "up", speed slow/medium
- "git-themed / version control" → git icons
- Default to "auto" color unless user mentions a specific color.
- Keep opacity low (<=0.15) for non-intrusive backgrounds unless user says "vivid" or "bold".`

interface ChatCompletionResponse {
  choices: Array<{
    message: { role: string; content: string }
    finish_reason?: string
  }>
}

/**
 * llama-server 가 OpenAI compatible 이라 fetch 로 직접 호출.
 * 응답에서 JSON 본문 추출 (검증은 호출자가).
 */
async function callLocalRaw(port: number, system: string, user: string): Promise<unknown> {
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

  const jsonText = extractJsonBlock(content)
  try {
    return JSON.parse(jsonText)
  } catch {
    throw new Error(`JSON 파싱 실패: ${jsonText.slice(0, 200)}`)
  }
}

async function callLocal(port: number, system: string, user: string): Promise<ThemePalette> {
  return validatePaletteShape(await callLocalRaw(port, system, user))
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
  readonly description = 'Pepper 내장 — 외부 API 키 불필요, 첫 사용 시 모델 다운로드 (~1~2GB)'

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

  async generateDecor({ prompt }: GenerateOptions): Promise<DecorConfig> {
    const modelId = getSelectedLocalModel()
    const port = await ensureServer(modelId)
    return validateDecorShape(await callLocalRaw(port, DECOR_SYSTEM_PROMPT, prompt))
  }
}