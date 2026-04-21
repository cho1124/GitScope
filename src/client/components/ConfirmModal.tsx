import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'

type Variant = 'danger' | 'warn' | 'info'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: Variant
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

interface PendingConfirm {
  id: number
  opts: ConfirmOptions
  resolve: (v: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<PendingConfirm[]>([])
  const current = queue[0]

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      setQueue(prev => [...prev, { id: Date.now() + Math.random(), opts, resolve }])
    })
  }, [])

  const resolveCurrent = (v: boolean) => {
    if (!current) return
    current.resolve(v)
    setQueue(prev => prev.slice(1))
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {current && (
        <ConfirmDialog
          opts={current.opts}
          onResolve={resolveCurrent}
        />
      )}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({ opts, onResolve }: { opts: ConfirmOptions; onResolve: (v: boolean) => void }) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onResolve(false)
      if (e.key === 'Enter') onResolve(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onResolve])

  const variant = opts.variant ?? 'info'
  const accent =
    variant === 'danger' ? 'var(--red)' :
    variant === 'warn' ? 'var(--yellow)' :
    'var(--accent)'
  const Icon = variant === 'info' ? Info : AlertTriangle

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={() => onResolve(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        opacity: entered ? 1 : 0,
        transition: 'opacity 0.15s ease-out'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: `1px solid ${accent}`,
          borderLeft: `4px solid ${accent}`,
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          minWidth: '320px',
          maxWidth: '480px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          transform: entered ? 'scale(1)' : 'scale(0.96)',
          transition: 'transform 0.15s ease-out'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '10px'
        }}>
          <Icon size={16} strokeWidth={2.5} color={accent} style={{ flexShrink: 0 }} />
          <h3 id="confirm-title" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {opts.title ?? '확인'}
          </h3>
        </div>

        <div style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          marginBottom: '16px',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6
        }}>
          {opts.message}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
          <button className="btn btn-sm" onClick={() => onResolve(false)} autoFocus>
            {opts.cancelLabel ?? '취소'}
          </button>
          <button
            className="btn btn-sm"
            onClick={() => onResolve(true)}
            style={
              variant === 'danger'
                ? { background: 'var(--red)', color: 'var(--bg-primary)', borderColor: 'var(--red)' }
                : variant === 'warn'
                ? { background: 'var(--yellow)', color: 'var(--bg-primary)', borderColor: 'var(--yellow)' }
                : { background: 'var(--accent)', color: 'var(--bg-primary)', borderColor: 'var(--accent)' }
            }
          >
            {opts.confirmLabel ?? '확인'}
          </button>
        </div>

        <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--text-muted)' }}>
          Enter: 확인 · Esc: 취소
        </div>
      </div>
    </div>
  )
}

export function useConfirm(): ConfirmContextValue['confirm'] {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx.confirm
}