import { useState, useEffect, useRef } from 'react'
import { Palette, Check } from 'lucide-react'

export type Theme = 'mocha' | 'latte' | 'frappe' | 'macchiato'

const themes: { id: Theme; label: string; preview: string }[] = [
  { id: 'mocha', label: 'Mocha', preview: '#1e1e2e' },
  { id: 'latte', label: 'Latte', preview: '#eff1f5' },
  { id: 'frappe', label: 'Frappé', preview: '#303446' },
  { id: 'macchiato', label: 'Macchiato', preview: '#24273a' },
]

const STORAGE_KEY = 'gitscope.theme'

function isTheme(v: unknown): v is Theme {
  return v === 'mocha' || v === 'latte' || v === 'frappe' || v === 'macchiato'
}

export function getSavedTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  return isTheme(saved) ? saved : 'mocha'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>(getSavedTheme())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = themes.find(t => t.id === theme)!

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-sm"
        onClick={() => setOpen(v => !v)}
        aria-label="테마 변경"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="테마 변경"
      >
        <Palette size={14} />
        {current.label}
      </button>
      {open && (
        <div role="listbox" aria-label="테마" className="theme-dropdown">
          {themes.map(t => (
            <button
              key={t.id}
              role="option"
              aria-selected={t.id === theme}
              className={`theme-option ${t.id === theme ? 'selected' : ''}`}
              onClick={() => {
                setTheme(t.id)
                setOpen(false)
              }}
            >
              <span className="theme-swatch" style={{ background: t.preview }} />
              <span style={{ flex: 1 }}>{t.label}</span>
              {t.id === theme && <Check size={12} color="var(--accent)" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}