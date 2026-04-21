import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'

type ToastKind = 'info' | 'success' | 'error' | 'warn'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void
  info: (message: string) => void
  success: (message: string) => void
  error: (message: string) => void
  warn: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random()
    setItems(prev => [...prev, { id, kind, message }])
    const timeout = kind === 'error' ? 6000 : 3000
    setTimeout(() => dismiss(id), timeout)
  }, [dismiss])

  const value: ToastContextValue = {
    show,
    info: (m) => show(m, 'info'),
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    warn: (m) => show(m, 'warn'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: '32px',
        right: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 9999,
        maxWidth: '420px',
        pointerEvents: 'none'
      }}>
        {items.map(t => (
          <ToastView key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10)
    return () => clearTimeout(t)
  }, [])

  const colorMap: Record<ToastKind, { bg: string; border: string; accent: string; icon: string }> = {
    info: { bg: 'var(--bg-secondary)', border: 'var(--accent)', accent: 'var(--accent)', icon: 'ⓘ' },
    success: { bg: 'var(--bg-secondary)', border: 'var(--green)', accent: 'var(--green)', icon: '✓' },
    error: { bg: 'var(--bg-secondary)', border: 'var(--red)', accent: 'var(--red)', icon: '✕' },
    warn: { bg: 'var(--bg-secondary)', border: 'var(--yellow)', accent: 'var(--yellow)', icon: '⚠' },
  }
  const c = colorMap[item.kind]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 14px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderLeft: `4px solid ${c.accent}`,
        borderRadius: 'var(--radius)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        fontSize: '12px',
        color: 'var(--text-primary)',
        minWidth: '240px',
        pointerEvents: 'auto',
        transform: entered ? 'translateX(0)' : 'translateX(20px)',
        opacity: entered ? 1 : 0,
        transition: 'transform 0.18s ease-out, opacity 0.18s ease-out'
      }}
    >
      <span style={{ color: c.accent, fontWeight: 700 }}>{c.icon}</span>
      <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.message}</div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '0 2px',
          fontSize: '13px',
          lineHeight: 1
        }}
        aria-label="닫기"
      >
        ×
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}