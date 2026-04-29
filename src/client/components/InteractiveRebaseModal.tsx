import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, GitMerge, X } from 'lucide-react'
import { api, type CommitInfo } from '../api'
import { useToast } from './Toast'

interface Props {
  from: string
  fromShort: string
  onClose: () => void
  onApplied: () => void
}

interface Item extends CommitInfo {
  keep: boolean
}

export function InteractiveRebaseModal({ from, fromShort, onClose, onApplied }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [entered, setEntered] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    setLoading(true)
    api.listCommitsInRange(from).then(r => {
      if (r.ok) {
        setItems(r.data.map(c => ({ ...c, keep: true })))
      } else {
        toast.error(`커밋 로드 실패: ${r.error}`)
        onClose()
      }
      setLoading(false)
    })
  }, [from, onClose, toast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applying, onClose])

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...items]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    setItems(next)
  }

  const moveDown = (idx: number) => {
    if (idx === items.length - 1) return
    const next = [...items]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    setItems(next)
  }

  const toggleKeep = (idx: number) => {
    const next = [...items]
    next[idx] = { ...next[idx], keep: !next[idx].keep }
    setItems(next)
  }

  const apply = async () => {
    setApplying(true)
    const operations = items.map(i => ({
      hash: i.hash,
      action: i.keep ? ('pick' as const) : ('drop' as const),
    }))
    const r = await api.interactiveRebase(from, operations)
    setApplying(false)
    if (r.ok) {
      toast.success('Interactive rebase 완료')
      onApplied()
    } else {
      toast.error(r.error)
    }
  }

  const keepCount = items.filter(i => i.keep).length
  const dropCount = items.length - keepCount

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="irebase-title"
      onClick={() => { if (!applying) onClose() }}
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
          border: '1px solid var(--mauve)',
          borderLeft: '4px solid var(--mauve)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          width: '640px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 80px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          transform: entered ? 'scale(1)' : 'scale(0.96)',
          transition: 'transform 0.15s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <GitMerge size={16} strokeWidth={2.5} color="var(--mauve)" style={{ flexShrink: 0 }} />
          <h3 id="irebase-title" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
            Interactive rebase
          </h3>
          <button
            aria-label="닫기"
            onClick={onClose}
            disabled={applying}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: applying ? 'not-allowed' : 'pointer', padding: 2, display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          <code style={{ color: 'var(--mauve)' }}>{fromShort}</code> 위로 재적용 ·
          {' '}<span style={{ color: 'var(--green)' }}>{keepCount} 유지</span>
          {' / '}<span style={{ color: 'var(--red)' }}>{dropCount} 드롭</span>
          {' · 충돌 시 자동 롤백'}
        </div>

        <div style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 'calc(var(--radius) - 2px)',
          background: 'var(--bg-primary)',
        }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              <span className="spinner" /> 로드 중
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              {fromShort} 이후에 적용할 커밋이 없습니다.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((item, idx) => (
                <li
                  key={item.hash}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                    fontSize: 12,
                    background: item.keep ? 'transparent' : 'rgba(243, 139, 168, 0.06)',
                    opacity: item.keep ? 1 : 0.55,
                  }}
                >
                  <button
                    aria-label="위로"
                    disabled={idx === 0 || applying}
                    onClick={() => moveUp(idx)}
                    style={{ ...iconBtnStyle, opacity: idx === 0 ? 0.3 : 1 }}
                  >
                    <ChevronUp size={12} strokeWidth={2.5} />
                  </button>
                  <button
                    aria-label="아래로"
                    disabled={idx === items.length - 1 || applying}
                    onClick={() => moveDown(idx)}
                    style={{ ...iconBtnStyle, opacity: idx === items.length - 1 ? 0.3 : 1 }}
                  >
                    <ChevronDown size={12} strokeWidth={2.5} />
                  </button>
                  <input
                    type="checkbox"
                    checked={item.keep}
                    onChange={() => toggleKeep(idx)}
                    disabled={applying}
                    aria-label={item.keep ? '드롭으로 변경' : 'pick으로 변경'}
                    style={{ cursor: applying ? 'not-allowed' : 'pointer' }}
                  />
                  <code style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {item.hashShort}
                  </code>
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-primary)',
                  }}>
                    {item.message}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{item.author}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
          <button className="btn btn-sm" onClick={onClose} disabled={applying}>
            취소
          </button>
          <button
            className="btn btn-sm"
            onClick={apply}
            disabled={applying || loading || items.length === 0 || keepCount === 0}
            style={{ background: 'var(--mauve)', color: 'var(--bg-primary)', borderColor: 'var(--mauve)' }}
          >
            {applying ? (
              <><span className="spinner" style={{ width: 10, height: 10, borderWidth: 1 }} /> 적용 중</>
            ) : (
              `Apply (${keepCount} 커밋)`
            )}
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
          Esc: 취소 · 충돌 발생 시 변경사항 없이 원상 복구됩니다
        </div>
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: '2px 4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
