import { useState, useMemo, useCallback } from 'react'
import { Pencil, Save, Copy, FileInput, AlertTriangle, Info, RotateCcw, X } from 'lucide-react'
import {
  SEMANTIC_TOKENS,
  type TokenKey, type TokenMap, type ThemePalette,
  contrastRatio, auditPalette, validatePaletteShape, HEX_REGEX,
} from '../lib/ai'

interface Props {
  /** 편집 시작 팔레트 — null 이면 빈 패널 */
  initial: ThemePalette | null
  /** 저장 — 호출 측이 라이브러리에 저장하고 적용 처리 */
  onSave: (palette: ThemePalette) => void
  /** 닫기 */
  onClose: () => void
  /** 값 변경 시마다 호출 — 호출 측에서 라이브 미리보기로 적용 */
  onLivePreview?: (palette: ThemePalette) => void
}

const TOKEN_LABELS: Record<TokenKey, string> = {
  'bg-primary': '메인 배경',
  'bg-secondary': '서브 배경 (헤더/사이드바)',
  'bg-surface': '카드/드롭다운',
  'bg-hover': 'hover 상태',
  'text-primary': '메인 텍스트',
  'text-secondary': '보조 텍스트',
  'text-muted': '약한 텍스트 (메타)',
  'border': '경계선',
  'accent': '강조 (링크/포커스)',
  'green': '성공/추가',
  'yellow': '경고',
  'peach': '주황 (알림)',
  'red': '에러/삭제/위험',
  'mauve': '브랜치/보조 강조',
}

const SECTIONS: Array<{ title: string; tokens: TokenKey[] }> = [
  { title: '배경', tokens: ['bg-primary', 'bg-secondary', 'bg-surface', 'bg-hover'] },
  { title: '텍스트', tokens: ['text-primary', 'text-secondary', 'text-muted'] },
  { title: '경계선', tokens: ['border'] },
  { title: '의미 색', tokens: SEMANTIC_TOKENS },
]

const DEFAULT_EMPTY: TokenMap = {
  'bg-primary': '#1e1e2e', 'bg-secondary': '#181825', 'bg-surface': '#313244', 'bg-hover': '#45475a',
  'text-primary': '#cdd6f4', 'text-secondary': '#bac2de', 'text-muted': '#7f849c',
  'border': '#45475a', 'accent': '#89b4fa', 'green': '#a6e3a1', 'yellow': '#f9e2af',
  'peach': '#fab387', 'red': '#f38ba8', 'mauve': '#cba6f7',
}

export function ManualPaletteEditor({ initial, onSave, onClose, onLivePreview }: Props) {
  const [name, setName] = useState(initial?.name ?? 'Custom Theme')
  const [tokens, setTokens] = useState<TokenMap>(initial?.tokens ?? DEFAULT_EMPTY)
  const [importText, setImportText] = useState('')
  const [importMode, setImportMode] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const setToken = useCallback((key: TokenKey, value: string) => {
    setTokens(prev => {
      const next = { ...prev, [key]: value.toLowerCase() }
      onLivePreview?.({ name, tokens: next })
      return next
    })
  }, [name, onLivePreview])

  const handleNameChange = useCallback((v: string) => {
    setName(v)
    onLivePreview?.({ name: v, tokens })
  }, [tokens, onLivePreview])

  const palette: ThemePalette = useMemo(() => ({ name, tokens }), [name, tokens])
  const warnings = useMemo(() => auditPalette(palette), [palette])

  const handleSave = () => {
    if (name.trim() === '') {
      return
    }
    onSave({ name: name.trim(), tokens })
  }

  const handleResetToInitial = () => {
    if (!initial) return
    setName(initial.name)
    setTokens(initial.tokens)
    onLivePreview?.(initial)
  }

  const handleCopyJson = () => {
    const json = JSON.stringify(palette, null, 2)
    navigator.clipboard.writeText(json).catch(() => {})
  }

  const handleImport = () => {
    setImportError(null)
    try {
      const parsed = JSON.parse(importText)
      const valid = validatePaletteShape(parsed)
      setName(valid.name)
      setTokens(valid.tokens)
      onLivePreview?.(valid)
      setImportText('')
      setImportMode(false)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 헤더 — 이름 + 액션 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Pencil size={12} color="var(--mauve)" />
        <input
          type="text"
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="테마 이름"
          style={{ flex: 1, fontSize: 12, fontWeight: 500 }}
        />
        {initial && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleResetToInitial}
            title="시작 팔레트로 되돌리기"
            style={{ padding: '4px 6px', display: 'flex' }}
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>

      {/* 임포트 섹션 (토글) */}
      {importMode ? (
        <div style={{
          padding: 8, border: '1px solid var(--border)',
          borderRadius: 'calc(var(--radius) - 2px)',
          background: 'var(--bg-primary)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            JSON 붙여넣기 ({`{name, tokens: {...14개}}`} 형식)
          </div>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            rows={4}
            style={{ width: '100%', fontSize: 10, fontFamily: 'var(--font-mono)', padding: '4px 6px' }}
            placeholder='{"name": "...", "tokens": { "bg-primary": "#...", ... }}'
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleImport}
              disabled={!importText.trim()}
              style={{ fontSize: 10, padding: '4px 8px' }}
            >
              임포트
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => { setImportMode(false); setImportText(''); setImportError(null) }}
              style={{ fontSize: 10, padding: '4px 8px' }}
            >
              취소
            </button>
          </div>
          {importError && (
            <div style={{
              marginTop: 4, fontSize: 10, color: 'var(--red)',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <AlertTriangle size={10} /> {importError}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setImportMode(true)}
            style={{ fontSize: 10, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            <FileInput size={11} /> JSON 임포트
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleCopyJson}
            style={{ fontSize: 10, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            <Copy size={11} /> JSON 복사
          </button>
        </div>
      )}

      {/* 섹션별 토큰 편집 */}
      {SECTIONS.map(section => (
        <div key={section.title}>
          <div style={{
            fontSize: 10, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            marginBottom: 4,
          }}>
            {section.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {section.tokens.map(key => (
              <TokenRow
                key={key}
                tokenKey={key}
                value={tokens[key]}
                onChange={v => setToken(key, v)}
                /* 텍스트 토큰엔 bg-primary 와의 대비비도 표시 */
                contrastWith={
                  key.startsWith('text-') || key === 'accent'
                    ? { bg: tokens['bg-primary'], target: key === 'text-primary' ? 4.5 : 3.0 }
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      ))}

      {/* 경고 패널 */}
      {warnings.length > 0 && (
        <div style={{
          padding: 8,
          background: 'rgba(249, 226, 175, 0.06)',
          border: '1px solid var(--yellow)',
          borderLeft: '3px solid var(--yellow)',
          borderRadius: 'calc(var(--radius) - 2px)',
        }}>
          <div style={{
            fontSize: 10, color: 'var(--yellow)',
            display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4,
          }}>
            <AlertTriangle size={11} strokeWidth={2.5} /> 검증 경고 {warnings.length}개
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10, color: 'var(--text-secondary)' }}>
            {warnings.slice(0, 5).map((w, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{w.message}</li>
            ))}
            {warnings.length > 5 && (
              <li style={{ color: 'var(--text-muted)' }}>...외 {warnings.length - 5}개</li>
            )}
          </ul>
        </div>
      )}

      {/* 액션 */}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={name.trim() === ''}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'var(--green)', color: 'var(--bg-primary)', borderColor: 'var(--green)',
            fontSize: 11, padding: '5px 10px',
          }}
        >
          <Save size={11} /> 저장
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={onClose}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, padding: '5px 10px',
          }}
        >
          <X size={11} /> 닫기
        </button>
      </div>
    </div>
  )
}

function TokenRow({
  tokenKey, value, onChange, contrastWith,
}: {
  tokenKey: TokenKey
  value: string
  onChange: (v: string) => void
  contrastWith?: { bg: string; target: number }
}) {
  const valid = HEX_REGEX.test(value)
  const cr = contrastWith ? contrastRatio(value, contrastWith.bg) : null
  const passes = cr !== null && contrastWith && cr >= contrastWith.target

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 6px',
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      borderRadius: 'calc(var(--radius) - 2px)',
    }}>
      <input
        type="color"
        value={valid ? value : '#000000'}
        onChange={e => onChange(e.target.value)}
        aria-label={`${tokenKey} color picker`}
        style={{
          width: 28, height: 24, padding: 0, border: 'none',
          cursor: 'pointer', background: 'transparent',
        }}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        style={{
          width: 80, fontSize: 10, fontFamily: 'var(--font-mono)',
          padding: '3px 5px',
          color: valid ? 'var(--text-primary)' : 'var(--red)',
          borderColor: valid ? 'var(--border)' : 'var(--red)',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
          {tokenKey}
        </div>
        <div style={{
          fontSize: 9, color: 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {TOKEN_LABELS[tokenKey]}
        </div>
      </div>
      {cr !== null && contrastWith && (
        <div
          title={`${tokenKey} on bg-primary 대비비 (목표 ${contrastWith.target.toFixed(1)}:1)`}
          style={{
            fontSize: 10, fontFamily: 'var(--font-mono)',
            color: passes ? 'var(--green)' : 'var(--yellow)',
            display: 'inline-flex', alignItems: 'center', gap: 2,
            flexShrink: 0,
          }}
        >
          {passes ? <Info size={10} /> : <AlertTriangle size={10} />}
          {cr.toFixed(2)}
        </div>
      )}
    </div>
  )
}

