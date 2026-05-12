import { useState, useEffect, useCallback } from 'react'
import {
  Settings as SettingsIcon, X, Check, Sparkles, Eye, EyeOff,
  Trash2, Copy, Pencil, AlertTriangle,
} from 'lucide-react'
import {
  type Theme, type CustomTheme,
  builtinThemes, getSavedTheme, applyTheme,
  getCustomThemes, saveCustomTheme, deleteCustomTheme,
} from './ThemeSelector'
import {
  listProviders, getProvider, getSelectedProviderId, setSelectedProviderId,
  type ThemePalette, type ThemeAiProvider, type ProviderAvailability,
  ANTHROPIC_API_KEY_STORAGE, ANTHROPIC_MODEL_STORAGE, ANTHROPIC_DEFAULT_MODEL,
  ANTHROPIC_MODEL_OPTIONS,
} from '../lib/ai'
import { ManualPaletteEditor } from './ManualPaletteEditor'
import { LocalAiSettings } from './LocalAiSettings'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'
import {
  useDateFormat, setDateFormat, type DateFormatMode,
  useRowPaddingY, setRowPaddingY,
  ROW_PADDING_MIN, ROW_PADDING_MAX, ROW_PADDING_DEFAULT,
} from '../lib/displaySettings'

interface Props {
  onClose: () => void
}

type EditorMode = 'closed' | 'manual' | 'ai-result' | 'edit-existing'

interface EditorState {
  mode: EditorMode
  initial: ThemePalette | null
  /** 'edit-existing' 일 때 갱신할 custom theme id */
  editingId?: string
}

const DEFAULT_EMPTY: ThemePalette = {
  name: 'Custom Theme',
  tokens: {
    'bg-primary': '#1e1e2e', 'bg-secondary': '#181825', 'bg-surface': '#313244', 'bg-hover': '#45475a',
    'text-primary': '#cdd6f4', 'text-secondary': '#bac2de', 'text-muted': '#7f849c',
    'border': '#45475a', 'accent': '#89b4fa', 'green': '#a6e3a1', 'yellow': '#f9e2af',
    'peach': '#fab387', 'red': '#f38ba8', 'mauve': '#cba6f7',
  },
}

export function SettingsModal({ onClose }: Props) {
  const toast = useToast()
  const confirm = useConfirm()
  const [theme, setTheme] = useState<Theme>(getSavedTheme())
  const [entered, setEntered] = useState(false)
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([])
  const dateFormat = useDateFormat()
  const rowPaddingY = useRowPaddingY()

  // provider 상태
  const providers = listProviders()
  const [providerId, setProviderId] = useState<string>(() => getSelectedProviderId())
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderAvailability>>({})

  // 생성기 상태
  const [genOpen, setGenOpen] = useState(false)
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(ANTHROPIC_API_KEY_STORAGE) ?? '')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState<string>(() => localStorage.getItem(ANTHROPIC_MODEL_STORAGE) ?? ANTHROPIC_DEFAULT_MODEL)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)

  // 편집기 상태
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed', initial: null })
  // 편집/AI 미리보기 시작 직전의 테마 (취소 시 복원)
  const [previewStash, setPreviewStash] = useState<Theme | null>(null)

  useEffect(() => { setCustomThemes(getCustomThemes()) }, [])

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10)
    return () => clearTimeout(t)
  }, [])

  // provider 가용 상태 갱신
  const refreshAvailability = useCallback(async () => {
    const next: Record<string, ProviderAvailability> = {}
    for (const p of providers) {
      next[p.id] = await p.isAvailable()
    }
    setProviderStatus(next)
  }, [providers])

  useEffect(() => {
    refreshAvailability()
  }, [refreshAvailability, apiKey])

  const handleClose = useCallback(() => {
    if (previewStash) applyTheme(previewStash)
    onClose()
  }, [previewStash, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  const handleSelectTheme = (next: Theme) => {
    if (previewStash) {
      // 미리보기 / 편집 중에 다른 테마 클릭 → 미리보기 취소
      setEditor({ mode: 'closed', initial: null })
      setPreviewStash(null)
    }
    setTheme(next)
    applyTheme(next)
  }

  const handleDeleteCustom = async (id: string, name: string) => {
    const ok = await confirm({
      title: '테마 삭제',
      message: `커스텀 테마 "${name}"를 삭제합니다.`,
      variant: 'danger',
      confirmLabel: '삭제',
    })
    if (!ok) return
    deleteCustomTheme(id)
    setCustomThemes(getCustomThemes())
    if (theme === id) handleSelectTheme('mocha')
    toast.info(`"${name}" 삭제됨`)
  }

  const handleEditExisting = (c: CustomTheme) => {
    if (!previewStash) setPreviewStash(theme)
    setEditor({
      mode: 'edit-existing',
      initial: { name: c.name, tokens: c.tokens },
      editingId: c.id,
    })
  }

  const handleManualNew = () => {
    if (!previewStash) setPreviewStash(theme)
    applyInline(DEFAULT_EMPTY)
    setEditor({ mode: 'manual', initial: DEFAULT_EMPTY })
  }

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      toast.error('테마 설명을 입력하세요')
      return
    }
    const provider = getProvider(providerId)
    if (!provider) {
      toast.error('Provider 가 선택되지 않았습니다')
      return
    }
    const status = await provider.isAvailable()
    if (!status.ok) {
      toast.error(`${provider.label} 사용 불가: ${status.reason}`)
      return
    }

    // Anthropic 의 경우 키/모델 자동 저장
    if (providerId === 'anthropic') {
      localStorage.setItem(ANTHROPIC_API_KEY_STORAGE, apiKey.trim())
      localStorage.setItem(ANTHROPIC_MODEL_STORAGE, model)
    }
    setSelectedProviderId(providerId)

    setBusy(true)
    try {
      const palette = await provider.generate({ prompt: trimmedPrompt, model })
      // 미리보기 stash + 편집기로 결과 넘기기
      if (!previewStash) setPreviewStash(theme)
      applyInline(palette)
      setEditor({ mode: 'ai-result', initial: palette })
    } catch (e) {
      toast.error(`테마 생성 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleEditorSave = (palette: ThemePalette) => {
    if (editor.mode === 'edit-existing' && editor.editingId) {
      // 기존 custom 갱신 — id 유지, name/tokens 교체
      const existing = customThemes.find(t => t.id === editor.editingId)
      const item: CustomTheme = {
        id: editor.editingId,
        name: palette.name,
        tokens: palette.tokens,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      }
      saveCustomTheme(item)
      setCustomThemes(getCustomThemes())
      setTheme(item.id)
      applyTheme(item.id)
      toast.success(`"${item.name}" 갱신됨`)
    } else {
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const item: CustomTheme = {
        id, name: palette.name, tokens: palette.tokens,
        createdAt: new Date().toISOString(),
      }
      saveCustomTheme(item)
      setCustomThemes(getCustomThemes())
      setTheme(id)
      applyTheme(id)
      toast.success(`"${item.name}" 저장됨`)
    }
    setEditor({ mode: 'closed', initial: null })
    setPreviewStash(null)
    setPrompt('')
  }

  const handleEditorClose = () => {
    if (previewStash) applyTheme(previewStash)
    setEditor({ mode: 'closed', initial: null })
    setPreviewStash(null)
    setTheme(getSavedTheme())
  }

  const handleCopyJson = (target: ThemePalette | CustomTheme) => {
    const json = JSON.stringify({ name: target.name, tokens: target.tokens }, null, 2)
    navigator.clipboard.writeText(json)
      .then(() => toast.info('JSON 클립보드 복사됨'))
      .catch(() => toast.error('클립보드 복사 실패'))
  }

  const selectedProvider = getProvider(providerId)
  const selectedStatus = providerStatus[providerId]
  const editorOpen = editor.mode !== 'closed'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
        opacity: entered ? 1 : 0, transition: 'opacity 0.15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          width: 600,
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 80px)',
          overflow: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          transform: entered ? 'scale(1)' : 'scale(0.96)',
          transition: 'transform 0.15s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <SettingsIcon size={16} strokeWidth={2.5} color="var(--accent)" style={{ flexShrink: 0 }} />
          <h3 id="settings-title" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
            설정
          </h3>
          <button
            aria-label="닫기"
            onClick={handleClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 2, display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* 테마 그리드 */}
        <Section title="테마">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {builtinThemes.map(t => {
              const selected = t.id === theme && !editorOpen
              return (
                <ThemeCard
                  key={t.id}
                  label={t.label}
                  preview={t.preview}
                  selected={selected}
                  onClick={() => handleSelectTheme(t.id)}
                />
              )
            })}
            {customThemes.map(c => {
              const selected = c.id === theme && !editorOpen
              return (
                <ThemeCard
                  key={c.id}
                  label={c.name}
                  preview={c.tokens['bg-primary']}
                  accent={c.tokens['accent']}
                  selected={selected}
                  onClick={() => handleSelectTheme(c.id)}
                  onEdit={() => handleEditExisting(c)}
                  onDelete={() => handleDeleteCustom(c.id, c.name)}
                  onCopy={() => handleCopyJson(c)}
                />
              )
            })}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleManualNew}
              disabled={editorOpen}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, padding: '5px 10px',
              }}
            >
              <Pencil size={11} /> 직접 만들기
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setGenOpen(v => !v)}
              disabled={editorOpen}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--mauve)', color: 'var(--bg-primary)', borderColor: 'var(--mauve)',
                fontSize: 11, padding: '5px 10px',
              }}
            >
              <Sparkles size={11} /> AI 생성기 {genOpen ? '닫기' : '열기'}
            </button>
          </div>
        </Section>

        {/* 표시 옵션 */}
        <Section title="표시">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <Label>커밋 날짜 표시</Label>
              <select
                value={dateFormat}
                onChange={e => setDateFormat(e.target.value as DateFormatMode)}
                style={{ width: '100%', fontSize: 11, padding: '4px 6px' }}
              >
                <option value="relative">상대 시간 (3일 전, 2주 전)</option>
                <option value="absolute">절대 날짜 (2026-05-09 14:32)</option>
              </select>
            </div>

            <div>
              <Label>
                커밋 행 세로 여백 — <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{rowPaddingY}px</span>
                {rowPaddingY !== ROW_PADDING_DEFAULT && (
                  <button
                    type="button"
                    onClick={() => setRowPaddingY(ROW_PADDING_DEFAULT)}
                    style={{
                      marginLeft: 6,
                      background: 'none', border: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer',
                      fontSize: 10, padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    초기화
                  </button>
                )}
              </Label>
              <input
                type="range"
                min={ROW_PADDING_MIN}
                max={ROW_PADDING_MAX}
                step={1}
                value={rowPaddingY}
                onChange={e => setRowPaddingY(parseInt(e.target.value, 10))}
                style={{ width: '100%' }}
              />
              <Hint>커밋 리스트 한 행의 위/아래 여백. 그래프 라인 높이도 함께 늘어납니다.</Hint>
            </div>
          </div>
        </Section>

        {/* 편집기가 열려 있으면 그것만 보여주기 (포커스) */}
        {editorOpen && editor.initial && (
          <Section
            title={
              editor.mode === 'ai-result' ? 'AI 생성 결과 — 미세 조정' :
              editor.mode === 'edit-existing' ? '기존 테마 편집' :
              '수동 편집'
            }
          >
            <ManualPaletteEditor
              key={`editor-${editor.mode}-${editor.editingId ?? 'new'}`}
              initial={editor.initial}
              onSave={handleEditorSave}
              onClose={handleEditorClose}
              onLivePreview={applyInline}
            />
          </Section>
        )}

        {/* AI 생성기 — 편집기 닫혀 있고 genOpen 일 때만 */}
        {genOpen && !editorOpen && (
          <Section title="AI 생성기">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Provider 선택 */}
              <div>
                <Label>Provider</Label>
                <select
                  value={providerId}
                  onChange={e => {
                    setProviderId(e.target.value)
                    setSelectedProviderId(e.target.value)
                  }}
                  style={{ width: '100%', fontSize: 11, padding: '4px 6px' }}
                >
                  {providers.map(p => {
                    const s = providerStatus[p.id]
                    const ok = s?.ok ?? false
                    return (
                      <option key={p.id} value={p.id}>
                        {p.label}{ok ? '' : ` — ${s?.reason ?? '확인 중'}`}
                      </option>
                    )
                  })}
                </select>
                {selectedProvider && (
                  <Hint>
                    {selectedProvider.description}
                    {selectedStatus && !selectedStatus.ok && (
                      <span style={{ color: 'var(--yellow)', display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6 }}>
                        <AlertTriangle size={9} /> {selectedStatus.reason}
                      </span>
                    )}
                  </Hint>
                )}
              </div>

              {/* Anthropic 전용 옵션 */}
              {providerId === 'anthropic' && (
                <>
                  <div>
                    <Label>Anthropic API 키 (sk-ant-...)</Label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="sk-ant-api03-..."
                        style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setShowKey(v => !v)}
                        aria-label={showKey ? '숨기기' : '보이기'}
                        style={{ padding: '4px 6px' }}
                      >
                        {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                    <Hint>로컬 localStorage 저장. console.anthropic.com 발급 키.</Hint>
                  </div>

                  <div>
                    <Label>모델</Label>
                    <select
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      style={{ width: '100%', fontSize: 11, padding: '4px 6px' }}
                    >
                      {ANTHROPIC_MODEL_OPTIONS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Local-llama: 엔진/모델 다운로드 + 시작/종료 UI */}
              {providerId === 'local-llama' && (
                <LocalAiSettings onChanged={refreshAvailability} />
              )}

              {/* 프롬프트 */}
              <div>
                <Label>테마 설명</Label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="예: 가을 숲속 분위기의 따뜻한 어두운 테마, 황금색 강조"
                  rows={2}
                  style={{ width: '100%', fontSize: 11, padding: '6px 8px', resize: 'vertical' }}
                  disabled={busy}
                />
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleGenerate}
                  disabled={busy || !selectedStatus?.ok}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}
                >
                  {busy ? (
                    <><span className="spinner" style={{ width: 11, height: 11, borderWidth: 1 }} /> 생성 중</>
                  ) : (
                    <><Sparkles size={11} /> 생성하기</>
                  )}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setGenOpen(false)}
                  disabled={busy}
                  style={{ fontSize: 11 }}
                >
                  닫기
                </button>
              </div>
            </div>
          </Section>
        )}

        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          Esc 또는 외부 클릭으로 닫기 · 편집 중이면 미리보기 자동 복원
        </div>
      </div>
    </div>
  )
}

function ThemeCard({
  label, preview, accent, selected, onClick, onDelete, onCopy, onEdit,
}: {
  label: string
  preview: string
  accent?: string
  selected: boolean
  onClick: () => void
  onDelete?: () => void
  onCopy?: () => void
  onEdit?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        background: selected ? 'var(--bg-surface)' : 'var(--bg-primary)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'calc(var(--radius) - 2px)',
        color: 'var(--text-primary)',
        fontSize: 12,
        cursor: 'pointer',
        textAlign: 'left',
        position: 'relative',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <span
          style={{
            display: 'block', width: 24, height: 24, borderRadius: 4,
            background: preview, border: '1px solid var(--border)',
          }}
        />
        {accent && (
          <span
            style={{
              position: 'absolute', right: -3, bottom: -3,
              width: 10, height: 10, borderRadius: '50%',
              background: accent, border: '1px solid var(--bg-secondary)',
            }}
          />
        )}
      </div>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {selected && <Check size={12} color="var(--accent)" />}
      {(onCopy || onDelete || onEdit) && (
        <div style={{ display: 'inline-flex', gap: 2 }}>
          {onEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit() }}
              aria-label="편집"
              title="편집"
              style={{
                background: 'none', border: 'none', color: 'var(--mauve)',
                cursor: 'pointer', padding: 2, display: 'flex',
              }}
            >
              <Pencil size={11} />
            </button>
          )}
          {onCopy && (
            <button
              onClick={e => { e.stopPropagation(); onCopy() }}
              aria-label="JSON 복사"
              title="JSON 복사"
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 2, display: 'flex',
              }}
            >
              <Copy size={11} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              aria-label="삭제"
              title="삭제"
              style={{
                background: 'none', border: 'none', color: 'var(--red)',
                cursor: 'pointer', padding: 2, display: 'flex',
              }}
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 10, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
      {children}
    </div>
  )
}

/** 미리보기 — 저장하지 않고 인라인 토큰만 적용 */
function applyInline(palette: ThemePalette) {
  document.documentElement.removeAttribute('data-theme')
  for (const [k, v] of Object.entries(palette.tokens)) {
    document.documentElement.style.setProperty(`--${k}`, v)
  }
}

// 사용 안 하지만 IDE 가 ThemeAiProvider 미사용 경고 안 내도록 (provider.label 등 직접 참조하므로 사실상 사용 중)
export type { ThemeAiProvider }
