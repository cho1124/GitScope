import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, X, Check } from 'lucide-react'
import { type Theme, getSavedTheme, applyTheme } from './ThemeSelector'

interface Props {
  onClose: () => void
}

const themes: { id: Theme; label: string; preview: string }[] = [
  { id: 'mocha', label: 'Mocha', preview: '#1e1e2e' },
  { id: 'macchiato', label: 'Macchiato', preview: '#24273a' },
  { id: 'frappe', label: 'Frappé', preview: '#303446' },
  { id: 'latte', label: 'Latte', preview: '#eff1f5' },
]

export function SettingsModal({ onClose }: Props) {
  const [theme, setTheme] = useState<Theme>(getSavedTheme())
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSelectTheme = (next: Theme) => {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        opacity: entered ? 1 : 0,
        transition: 'opacity 0.15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          width: 480,
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
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 2, display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* 테마 섹션 */}
        <Section title="테마">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {themes.map(t => {
              const selected = t.id === theme
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTheme(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    background: selected ? 'var(--bg-surface)' : 'var(--bg-primary)',
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'calc(var(--radius) - 2px)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      background: t.preview,
                      border: '1px solid var(--border)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1 }}>{t.label}</span>
                  {selected && <Check size={12} color="var(--accent)" />}
                </button>
              )
            })}
          </div>
        </Section>

        {/* 향후 확장 슬롯 — 데모 안내 */}
        <Section title="기타">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            향후 확장 예정 (편집기 연동, 단축키 커스터마이징 등)
          </div>
        </Section>

        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          Esc 또는 외부 클릭으로 닫기
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}
