import { useState, useEffect } from 'react'
import { api } from '../api'

interface CommitInfo {
  hash: string
  hashShort: string
  message: string
  author: string
  date: string
  refs: string
}

interface Props {
  selectedCommit: string | null
  onSelectCommit: (hash: string) => void
  file?: string | null
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
      {commits.map(commit => (
        <li
          key={commit.hash}
          className={`commit-item ${selectedCommit === commit.hash ? 'selected' : ''}`}
          onClick={() => onSelectCommit(commit.hash)}
        >
          <span className="commit-hash">{commit.hashShort}</span>
          <span className="commit-message">
            {commit.refs && (
              <span style={{
                background: 'var(--bg-hover)', padding: '1px 6px',
                borderRadius: '3px', fontSize: '10px', marginRight: '6px', color: 'var(--mauve)'
              }}>{commit.refs}</span>
            )}
            {commit.message}
          </span>
          <span className="commit-meta">{commit.author} · {formatDate(commit.date)}</span>
        </li>
      ))}
    </ul>
  )
}