import {
  type ThemeAiProvider, type ProviderAvailability,
  type GenerateOptions, type RefineOptions, type ThemePalette,
} from './types'

/**
 * 로컬 llama.cpp sidecar 기반 provider — Phase 11-B 구현 예정.
 * 현 단계에선 항상 unavailable 반환. 인터페이스만 잡아둠.
 *
 * 통합 시 Tauri invoke('get_ai_status' / 'generate_local_theme') 사용 예정.
 */
export class LocalLlamaThemeProvider implements ThemeAiProvider {
  readonly id = 'local-llama'
  readonly label = '로컬 디자인 엔진 (llama.cpp + Gemma)'
  readonly description = 'GitScope 내장 — 외부 서비스 불필요. 추후 Phase 11-B에서 활성화'

  async isAvailable(): Promise<ProviderAvailability> {
    return {
      ok: false,
      reason: 'Phase 11-B 구현 예정 — llama.cpp sidecar + Gemma GGUF 번들 작업 중',
    }
  }

  async generate(_opts: GenerateOptions): Promise<ThemePalette> {
    throw new Error('로컬 디자인 엔진은 아직 활성화되지 않았습니다 (Phase 11-B)')
  }

  async refine(_opts: RefineOptions): Promise<ThemePalette> {
    throw new Error('로컬 디자인 엔진은 아직 활성화되지 않았습니다 (Phase 11-B)')
  }
}
