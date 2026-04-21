import { useState, useEffect } from 'react'
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

export function CommitLog({ selectedCommit, onSelectCommit, file }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const opts = file ? { file, maxCount: 100 } : { maxCount: 200 }
    api.getLog(opts).then(result => {
      if (result.ok) setCommits(result.data)
      setLoading(false)
    })
  }, [file])

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
    <ul className="commit-list">
      {commits.map(commit => {
        const parsed = parseRefs(commit.refs)
        return (
          <li
            key={commit.hash}
            className={`commit-item ${selectedCommit === commit.hash ? 'selected' : ''}`}
            onClick={() => onSelectCommit(commit.hash)}
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
                <span key={`t-${t}`} style={{ ...pillStyle, background: 'rgba(249, 226, 175, 0.15)', color: 'var(--yellow)' }}>
                  🏷 {t}
                </span>
              ))}
              {commit.message}
            </span>
            <span className="commit-meta">{commit.author} · {formatDate(commit.date)}</span>
          </li>
        )
      })}
    </ul>
  )
}