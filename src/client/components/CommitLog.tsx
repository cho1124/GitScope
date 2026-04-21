import { useState, useEffect, useCallback, useRef } from 'react'
import { Tag } from 'lucide-react'
import { api, type CommitInfo } from '../api'

interface Props {
  selectedCommit: string | null
  onSelectCommit: (hash: string) => void
  file?: string | null
}

interface ParsedRefs {
  head: boolean
  branches: string[]
  remotes: string[]
  tags: string[]
}

function parseRefs(refs: string): ParsedRefs {
  const result: ParsedRefs = { head: false, branches: [], remotes: [], tags: [] }
  if (!refs) return result
  for (const raw of refs.split(',').map(s => s.trim()).filter(Boolean)) {
    if (raw.startsWith('HEAD -> ')) {
      result.head = true
      result.branches.push(raw.slice('HEAD -> '.length))
    } else if (raw === 'HEAD') {
      result.head = true
    } else if (raw.startsWith('tag: ')) {
      result.tags.push(raw.slice('tag: '.length))
    } else if (raw.includes('/')) {
      result.remotes.push(raw)
    } else {
      result.branches.push(raw)
    }
  }
  return result
}

const pillStyle: React.CSSProperties = {
  padding: '1px 6px',
  borderRadius: '3px',
  fontSize: '10px',
  marginRight: '4px',
  fontFamily: 'var(--font-mono)',
  display: 'inline-block',
  whiteSpace: 'nowrap'
}

const PAGE_SIZE = 100

export function CommitLog({ selectedCommit, onSelectCommit, file }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  // 초기/파일 변경 시 로드
  useEffect(() => {
    setLoading(true)
    setReachedEnd(false)
    api.getLog({ maxCount: PAGE_SIZE, file: file ?? undefined }).then(result => {
      if (result.ok) {
        setCommits(result.data)
        if (result.data.length < PAGE_SIZE) setReachedEnd(true)
      }
      setLoading(false)
    })
  }, [file])

  const loadMore = useCallback(async () => {
    if (loadingMore || reachedEnd) return
    setLoadingMore(true)
    const result = await api.getLog({
      maxCount: commits.length + PAGE_SIZE,
      file: file ?? undefined
    })
    setLoadingMore(false)
    if (result.ok) {
      const next = result.data
      if (next.length <= commits.length) {
        setReachedEnd(true)
      } else {
        setCommits(next)
        if (next.length - commits.length < PAGE_SIZE) setReachedEnd(true)
      }
    }
  }, [commits.length, file, loadingMore, reachedEnd])

  // 키보드 네비 (↑/↓) — 리스트에 focus 된 상태에서
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!listRef.current) return
      if (!listRef.current.contains(document.activeElement) && document.activeElement !== listRef.current) return
      if (commits.length === 0) return

      const currentIdx = selectedCommit ? commits.findIndex(c => c.hash === selectedCommit) : -1

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        const next = currentIdx < commits.length - 1 ? currentIdx + 1 : 0
        onSelectCommit(commits[next].hash)
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        const prev = currentIdx > 0 ? currentIdx - 1 : commits.length - 1
        onSelectCommit(commits[prev].hash)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commits, selectedCommit, onSelectCommit])

  // 선택된 커밋이 바뀌면 스크롤로 맞춰줌
  useEffect(() => {
    if (!selectedCommit || !listRef.current) return
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-hash="${selectedCommit}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selectedCommit])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return '오늘'
    if (days === 1) return '어제'
    if (days < 7) return `${days}일 전`
    if (days < 30) return `${Math.floor(days / 7)}주 전`
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (loading) return <div className="loading"><span className="spinner" /> 커밋 로딩 중...</div>
  if (commits.length === 0) return <div className="loading">커밋이 없습니다</div>

  return (
    <>
      <ul
        ref={listRef}
        className="commit-list"
        tabIndex={0}
        role="listbox"
        aria-label="커밋 목록 (↑/↓ 또는 j/k 로 이동)"
      >
        {commits.map(commit => {
          const parsed = parseRefs(commit.refs)
          const isSelected = selectedCommit === commit.hash
          return (
            <li
              key={commit.hash}
              data-hash={commit.hash}
              className={`commit-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectCommit(commit.hash)}
              role="option"
              aria-selected={isSelected}
            >
              <span className="commit-hash">{commit.hashShort}</span>
              <span className="commit-message">
                {parsed.head && (
                  <span style={{ ...pillStyle, background: 'var(--accent)', color: 'var(--bg-primary)' }}>
                    HEAD
                  </span>
                )}
                {parsed.branches.map(b => (
                  <span key={`b-${b}`} style={{ ...pillStyle, background: 'var(--bg-hover)', color: 'var(--mauve)' }}>
                    {b}
                  </span>
                ))}
                {parsed.remotes.map(r => (
                  <span key={`r-${r}`} style={{ ...pillStyle, background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                    {r}
                  </span>
                ))}
                {parsed.tags.map(t => (
                  <span key={`t-${t}`} style={{ ...pillStyle, background: 'rgba(249, 226, 175, 0.15)', color: 'var(--yellow)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Tag size={9} strokeWidth={2.5} /> {t}
                  </span>
                ))}
                {commit.message}
              </span>
              <span className="commit-meta">{commit.author} · {formatDate(commit.date)}</span>
            </li>
          )
        })}
      </ul>

      {/* 페이지네이션 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)'
      }}>
        {reachedEnd ? (
          <span>총 {commits.length}개 · 끝</span>
        ) : (
          <>
            <span style={{ marginRight: '8px' }}>{commits.length}개 로드됨</span>
            <button
              className="btn btn-sm"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <><span className="spinner" style={{ width: 10, height: 10, borderWidth: 1 }} /> 로드 중</>
              ) : (
                `+${PAGE_SIZE}개 더 보기`
              )}
            </button>
          </>
        )}
      </div>
    </>
  )
}