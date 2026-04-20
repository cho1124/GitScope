import { useState, useEffect } from 'react'
import { api } from '../api'

interface CommitInfo {
  hash: string
  hashShort: string
  message: string
  author: string
  date: string
}

interface Props { filePath: string }

export function FileHistory({ filePath }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getFileHistory(filePath).then(result => {
      if (result.ok) setCommits(result.data)
      setLoading(false)
    })
  }, [filePath])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  if (loading) return <div className="loading"><span className="spinner" /> 히스토리 로딩 중...</div>

  return (
    <div>
      <div style={{
        padding: '8px 12px', fontSize: '11px', color: 'var(--accent)',
        fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)'
      }}>{filePath}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px 12px' }}>총 {commits.length}개 커밋</div>
      {commits.map((commit, i) => (
        <div key={commit.hash} style={{
          display: 'flex', gap: '8px', padding: '6px 12px',
          borderBottom: '1px solid var(--border)', cursor: 'pointer'
        }} className="file-tree-item">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '16px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: i === 0 ? 'var(--accent)' : 'var(--bg-hover)',
              border: '2px solid var(--accent)', flexShrink: 0
            }} />
            {i < commits.length - 1 && (
              <div style={{ width: '1px', flex: 1, background: 'var(--border)', marginTop: '2px' }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {commit.message}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{commit.hashShort}</span>
              {' · '}{commit.author}{' · '}{formatDate(commit.date)}
            </div>
          </div>
        </div>
      ))}
      {commits.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px' }}>히스토리가 없습니다</div>
      )}
    </div>
  )
}