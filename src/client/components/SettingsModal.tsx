import { useState, useEffect, useMemo } from 'react'
import {
  Settings as SettingsIcon, X, Check, Sparkles, Eye, EyeOff,
  Trash2, Save, Copy, AlertTriangle,
} from 'lucide-react'
import {
  type Theme, type CustomTheme,
  builtinThemes, getSavedTheme, applyTheme,
  getCustomThemes, saveCustomTheme, deleteCustomTheme,
} from './ThemeSelector'
import { generateTheme, contrastRatio, type ThemePalette } from '../lib/themeGenerator'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

interface Props {
  onClose: () => void
}

const API_KEY_STORAGE = 'gitscope.anthropicApiKey'
const MODEL_STORAGE = 'gitscope.themeGenModel'
const DEFAULT_MODEL = 'claude-opus-4-7'

const MODEL_OPTIONS = [
  { id: 'claude-opus-4-7', label: 'Opus 4.7 (가장 높은 품질, $5/$25 per 1M)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (밸런스, $3/$15)' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 (가장 빠르고 저렴, $1/$5)' },
]

export function SettingsModal({ onClose }: Props) {
  const toast = useToast()
  const confirm = useConfirm()
  const [theme, setTheme] = useState<Theme>(getSavedTheme())
  const [entered, setEntered] = useState(false)
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([])

  // 생성기 상태
  const [genOpen, setGenOpen] = useState(false)
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(API_KEY_STORAGE) ?? '')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState<string>(() => localStorage.getItem(MODEL_STORAGE) ?? DEFAULT_MODEL)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  // 생성 후 확정 전 미리보기 상태 — 저장 또는 취소되기 전까지 임시 적용
  const [preview, setPreview] = useState<ThemePalette | null>(null)
  // 미리보기 시작 직전의 테마(취소 시 복원)
  const [previewStash, setPreviewStash] = useState<Theme | null>(null)

  useEffect(() => { setCustomThemes(getCustomThemes()) }, [])

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewStash])

  const handleClose = () => {
    // 미리보기 중이면 원래 테마 복원하고 닫기
    if (previewStash) applyTheme(previewStash)
    onClose()
  }

  const handleSelectTheme = (next: Theme) => {
    // 미리보기 중에 다른 테마 선택하면 미리보기 취소
    if (previewStash) {
      setPreview(null)
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
    if (theme === id) {
      // 현재 적용된 테마가 삭제되면 mocha로 복귀
      handleSelectTheme('mocha')
    }
    toast.info(`"${name}" 삭제됨`)
  }

  const handleGenerate = async () => {
    const trimmedKey = apiKey.trim()
    const trimmedPrompt = prompt.trim()
    if (!trimmedKey) {
      toast.error('Anthropic API 키를 입력하세요')
      return
    }
    if (!trimmedPrompt) {
      toast.error('테마 설명을 입력하세요')
      return
    }

    // API 키 / 모델 자동 저장
    localStorage.setItem(API_KEY_STORAGE, trimmedKey)
    localStorage.setItem(MODEL_STORAGE, model)

    setBusy(true)
    try {
      const palette = await generateTheme({ apiKey: trimmedKey, prompt: trimmedPrompt, model })

      // WCAG AA contrast 경고 (차단은 안 함)
      const cr = contrastRatio(palette.tokens['text-primary'], palette.tokens['bg-primary'])
      if (cr < 4.5) {
        toast.warn(`경고: text/bg 대비비 ${cr.toFixed(2)}:1 (WCAG AA 4.5 미달)`)
      }

      // 미리보기 시작 — 현재 테마 stash 후 임시 적용
      if (!previewStash) setPreviewStash(theme)
      applyInline(palette)
      setPreview(palette)
    } catch (e) {
      toast.error(`테마 생성 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleSavePreview = () => {
    if (!preview) return
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const item: CustomTheme = {
      id,
      name: preview.name,
      tokens: preview.tokens,
      createdAt: new Date().toISOString(),
    }
    saveCustomTheme(item)
    setCustomThemes(getCustomThemes())
    setTheme(id)
    applyTheme(id)
    setPreview(null)
    setPreviewStash(null)
    setPrompt('')
    toast.success(`"${item.name}" 저장됨`)
  }

  const handleDiscardPreview = () => {
    if (previewStash) applyTheme(previewStash)
    setPreview(null)
    setPreviewStash(null)
    setTheme(getSavedTheme())
  }

  const handleCopyJson = (target: ThemePalette | CustomTheme) => {
    const payload = 'tokens' in target ? target : null
    if (!payload) return
    const json = JSON.stringify({ name: target.name, tokens: target.tokens }, null, 2)
    navigator.clipboard.writeText(json)
      .then(() => toast.info('JSON 클립보드 복사됨'))
      .catch(() => toast.error('클립보드 복사 실패'))
  }

  const previewWarning = useMemo(() => {
    if (!preview) return null
    const cr = contrastRatio(preview.tokens['text-primary'], preview.tokens['bg-primary'])
    if (cr < 4.5) return `WCAG AA 미달 (${cr.toFixed(2)}:1)`
    return null
  }, [preview])

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
          width: 560,
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

        {/* 테마 섹션 — 기본 + custom 그리드 */}
        <Section title="테마">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {builtinThemes.map(t => {
              const selected = t.id === theme && !preview
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
              const selected = c.id === theme && !preview
              return (
                <ThemeCard
                  key={c.id}
                  label={c.name}
                  preview={c.tokens['bg-primary']}
                  accent={c.tokens['accent']}
                  selected={selected}
                  onClick={() => handleSelectTheme(c.id)}
                  onDelete={() => handleDeleteCustom(c.id, c.name)}
                  onCopy={() => handleCopyJson(c)}
                />
              )
            })}
          </div>
        </Section>

        {/* AI 테마 생성기 */}
        <Section title="AI로 새 테마 만들기">
          {!genOpen ? (
            <button
              className="btn btn-sm"
              onClick={() => setGenOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--mauve)', color: 'var(--bg-primary)', borderColor: 'var(--mauve)',
                fontSize: 12, padding: '6px 12px',
              }}
            >
              <Sparkles size={12} /> 생성기 열기
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* API 키 */}
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
                    title={showKey ? '숨기기' : '보이기'}
                    style={{ padding: '4px 6px' }}
                  >
                    {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                <Hint>로컬 localStorage 저장. 직접 console.anthropic.com 에서 발급한 키 사용.</Hint>
              </div>

              {/* 모델 선택 */}
              <div>
                <Label>모델</Label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  style={{ width: '100%', fontSize: 11, padding: '4px 6px' }}
                >
                  {MODEL_OPTIONS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

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

              {/* 액션 */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleGenerate}
                  disabled={busy}
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
                  onClick={() => { setGenOpen(false); handleDiscardPreview() }}
                  disabled={busy}
                  style={{ fontSize: 11 }}
                >
                  닫기
                </button>
              </div>

              {/* 미리보기 */}
              {preview && (
                <div
                  style={{
                    border: '1px solid var(--mauve)',
                    borderLeft: '3px solid var(--mauve)',
                    borderRadius: 'calc(var(--radius) - 2px)',
                    padding: 10,
                    background: 'rgba(203, 166, 247, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Sparkles size={12} color="var(--mauve)" />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{preview.name}</span>
                    {previewWarning && (
                      <span style={{
                        fontSize: 10, color: 'var(--yellow)',
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                      }}>
                        <AlertTriangle size={10} /> {previewWarning}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
                    {Object.entries(preview.tokens).map(([k, v]) => (
                      <div
                        key={k}
                        title={`--${k}: ${v}`}
                        style={{
                          width: 18, height: 18, borderRadius: 3,
                          background: v, border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn btn-sm"
                      onClick={handleSavePreview}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'var(--green)', color: 'var(--bg-primary)', borderColor: 'var(--green)',
                        fontSize: 10, padding: '4px 8px',
                      }}
                    >
                      <Save size={11} /> 저장
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleCopyJson(preview)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '4px 8px' }}
                    >
                      <Copy size={11} /> JSON 복사
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={handleDiscardPreview}
                      style={{ fontSize: 10, padding: '4px 8px' }}
                    >
                      취소
                    </button>
                    <div style={{ flex: 1 }} />
                    <button
                      className="btn btn-sm"
                      onClick={handleGenerate}
                      disabled={busy}
                      title="다시 생성 (같은 프롬프트로)"
                      style={{ fontSize: 10, padding: '4px 8px' }}
                    >
                      재생성
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          Esc 또는 외부 클릭으로 닫기
        </div>
      </div>
    </div>
  )
}

function ThemeCard({
  label, preview, accent, selected, onClick, onDelete, onCopy,
}: {
  label: string
  preview: string
  accent?: string
  selected: boolean
  onClick: () => void
  onDelete?: () => void
  onCopy?: () => void
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
      {(onCopy || onDelete) && (
        <div style={{ display: 'inline-flex', gap: 2 }}>
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

/** 미리보기 시 즉시 토큰 적용 (저장하지 않고 인라인만) */
function applyInline(palette: ThemePalette) {
  document.documentElement.removeAttribute('data-theme')
  for (const [k, v] of Object.entries(palette.tokens)) {
    document.documentElement.style.setProperty(`--${k}`, v)
  }
}
