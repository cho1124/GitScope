// Catppuccin 토큰 14개 — global.css의 CSS 변수와 정확히 매칭
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

/** 의미 색 — hue 거리 검사 대상 */
export const SEMANTIC_TOKENS: TokenKey[] = ['accent', 'green', 'yellow', 'peach', 'red', 'mauve']

export interface ProviderAvailability {
  ok: boolean
  /** 사용 불가 시 사유 (UI 표시용) */
  reason?: string
}

export interface GenerateOptions {
  prompt: string
  /** 선택적 모델 지정 (provider별로 의미 다름) */
  model?: string
}

export interface RefineOptions {
  base: ThemePalette
  instruction: string
  model?: string
}

/**
 * Theme AI Provider 추상.
 * 모든 generator (Anthropic BYOK / 로컬 llama / OpenAI 등)는 이 인터페이스를 구현한다.
 */
export interface ThemeAiProvider {
  /** 'anthropic' | 'local-llama' | 'openai' 등 — 직렬화/저장용 ID */
  readonly id: string
  /** UI 표시용 라벨 */
  readonly label: string
  /** 한 줄 설명 (UI 보조) */
  readonly description: string
  /** 현재 환경에서 사용 가능한지 (API 키 / sidecar 상태 등) */
  isAvailable(): Promise<ProviderAvailability>
  /** 새 팔레트 생성 */
  generate(opts: GenerateOptions): Promise<ThemePalette>
  /** 기존 팔레트를 자연어로 수정 (선택 — Phase 11-C) */
  refine?(opts: RefineOptions): Promise<ThemePalette>
  /** 자연어 → 배경 데코 설정 생성 (Phase 11-D-2) */
  generateDecor?(opts: GenerateOptions): Promise<import('../decorSettings').DecorConfig>
  /** Staged diff → conventional commit 메시지 생성 (Phase 11-B-2) */
  generateCommitMessage?(opts: CommitMessageOptions): Promise<string>
  /** 심볼 단위 git log -L 결과 → 함수/클래스의 진화 요약 (Phase 11-B-2) */
  summarizeSymbolHistory?(opts: SymbolHistoryOptions): Promise<string>
}

export interface CommitMessageOptions {
  /** `git diff --cached` 전체 결과 */
  diff: string
  /** 사용자 힌트 (선택). 예: "리팩토링" / "버그 픽스" */
  hint?: string
  /** 언어 선호 — 기본 'auto' (모델이 diff 내용에 맞춰 결정) */
  language?: 'auto' | 'ko' | 'en'
}

export interface SymbolHistoryOptions {
  /** `git log -L <s>,<e>:<file>` 출력 (커밋 메타 + 심볼 영역 diff 들의 시리즈) */
  logPatch: string
  /** 심볼 이름 (UI 표시 + 프롬프트 컨텍스트) */
  symbolName: string
  /** 심볼 종류 (function/class/method 등) */
  symbolKind?: string
  /** 파일 경로 */
  filePath: string
  language?: 'auto' | 'ko' | 'en'
}
