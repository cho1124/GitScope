import { useState, useEffect } from 'react'
import { api } from '../api'

interface Props {
  onCommitDone: () => void
}

export function CommitPanel({ onCommitDone }: Props) {
  const [status, setStatus] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [committing, setCommitting] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    const result = await api.getStatus()
    if (result.ok) setStatus(result.data)
    setLoading(false)
  }

  useEffect(() => { loadStatus() }, [])

  const handleStageAll = async () => {
    if (!status) return
    const files = [...(status.not_added || []), ...(status.modified || []), ...(status.deleted || [])]
    if (files.length === 0) return
    await api.stage(files)
    await loadStatus()
  }

  const handleStageFile = async (file: string) => {
    await api.stage([file])
    await loadStatus()
  }

  const handleCommit = async () => {
    if (!message.trim()) return
    setCommitting(true)
    const result = await api.commit(message)
    setCommitting(false)
    if (result.ok) {
      setMessage('')
      onCommitDone()
      await loadStatus()
    } else {
      alert(result.error)
    }
  }

  const handlePush = async () => {
    const result = await api.push()
    if (!result.ok) alert(result.error)
  }

  const handlePull = async () => {
    const result = await api.pull()
    if (result.ok) { onCommitDone(); await loadStatus() }
    else alert(result.error)
  }

  if (loading) return <div className="loading"><span className="spinner" /> 상태 로딩 중...</div>

  const staged = status?.staged || []
  const unstaged = [...(status?.modified || []), ...(status?.not_added || []), ...(status?.deleted || [])]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-sm" onClick={handlePull}>Pull</button>
        <button className="btn btn-sm" onClick={handlePush}>Push</button>
        <button className="btn btn-sm" onClick={loadStatus}>새로고침</button>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '12px', color: 'var(--text-muted)' }}>변경된 파일 ({unstaged.length})</h3>
          {unstaged.length > 0 && <button className="btn btn-sm" onClick={handleStageAll}>모두 Stage</button>}
        </div>
        {unstaged.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px' }}>변경된 파일이 없습니다</div>
        ) : (
          <ul className="commit-list">
            {unstaged.map(file => (
              <li key={file} className="commit-item" onClick={() => handleStageFile(file)} title="클릭하여 Stage">
                <span style={{ color: 'var(--yellow)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>M</span>
                <span className="commit-message" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{file}</span>
                <span className="btn btn-sm" style={{ fontSize: '10px' }}>+ Stage</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: '12px', color: 'var(--green)', marginBottom: '8px' }}>Staged ({staged.length})</h3>
        {staged.length > 0 && (
          <ul className="commit-list">
            {staged.map(file => (
              <li key={file} className="commit-item">
                <span style={{ color: 'var(--green)', fontSize: '11px' }}>✓</span>
                <span className="commit-message" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{file}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="커밋 메시지..."
          style={{ width: '100%', minHeight: '60px', marginBottom: '8px' }}
        />
        <button
          className="btn btn-primary"
          onClick={handleCommit}
          disabled={committing || !message.trim() || staged.length === 0}
          style={{ width: '100%' }}
        >
          {committing ? '커밋 중...' : `커밋 (${staged.length}개 파일)`}
        </button>
      </div>
    </div>
  )
}