import { useState, useEffect, useCallback, useRef } from 'react'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { Folder, ChevronDown, Check, FolderOpen, X } from 'lucide-react'
import { api, type RecentRepo } from '../api'

interface Props {
  currentPath: string
  currentName: string
  onPickRepo: (path: string) => void
}

export function RepoSelector({ currentPath, currentName, onPickRepo }: Props) {
  const [recents, setRecents] = useState<RecentRepo[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadRecents = useCallback(async () => {
    const r = await api.getRecentRepos()
    if (r.ok) setRecents(r.data)
  }, [])

  useEffect(() => {
    if (open) loadRecents()
  }, [open, loadRecents])

  // 외부 클릭 / Esc 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handlePickFolder = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: 'Git 레포지토리 선택',
    })
    if (typeof selected === 'string' && selected) {
      setOpen(false)
      onPickRepo(selected)
    }
  }

  const handleRemove = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await api.removeRecentRepo(path)
    await loadRecents()
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        className="btn btn-sm"
        onClick={() => setOpen(v => !v)}
        title={currentPath}
        style={{
          fontFamily: 'var(--font-mono)',
          minWidth: 160,
          maxWidth: 280,
          justifyContent: 'flex-start',
        }}
      >
        <Folder size={12} color="var(--peach)" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentName}
        </span>
        <ChevronDown size={12} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 360,
            maxWidth: 480,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 100,
            padding: 6,
            maxHeight: '60vh',
            overflow: 'auto',
          }}
        >
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            padding: '4px 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            최근 레포 ({recents.length})
          </div>

          {recents.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              최근에 연 레포가 없습니다
            </div>
          ) : (
            recents.map(r => {
              const isCurrent = r.path === currentPath
              return (
                <button
                  key={r.path}
                  onClick={() => {
                    setOpen(false)
                    if (!isCurrent) onPickRepo(r.path)
                  }}
                  title={r.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 8px',
                    background: isCurrent ? 'var(--bg-surface)' : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    if (!isCurrent) e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={e => {
                    if (!isCurrent) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ width: 12, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center' }}>
                    {isCurrent ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <Folder size={12} color="var(--peach)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {r.name}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {r.path}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleRemove(r.path, e)}
                    title="목록에서 제거"
                    aria-label={`${r.name} 목록에서 제거`}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={11} />
                  </button>
                </button>
              )
            })
          )}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
            <button
              onClick={handlePickFolder}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                color: 'var(--accent)',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <FolderOpen size={12} />
              <span>다른 폴더 열기...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
