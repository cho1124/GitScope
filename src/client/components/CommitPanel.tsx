import { useState, useEffect, useCallback } from 'react'
import { api, type StatusInfo } from '../api'
import { DiffView } from './DiffView'
import { useToast } from './Toast'
import { StashAccordion } from './StashAccordion'

interface Props {
  onCommitDone: () => void
}

type SelectedFile = { path: string; staged: boolean } | null

export function CommitPanel({ onCommitDone }: Props) {
  const toast = useToast()
  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [committing, setCommitting] = useState(false)
  const [selected, setSelected] = useState<SelectedFile>(null)
  const [diff, setDiff] = useState<string>('')
  const [diffLoading, setDiffLoading] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    const result = await api.getStatus()
    if (result.ok) setStatus(result.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // 선택된 파일 diff 로드
  useEffect(() => {
    if (!selected) {
      setDiff('')
      return
    }
    setDiffLoading(true)
    const loader = selected.staged ? api.getStagedDiff(selected.path) : api.getUnstagedDiff(selected.path)
    loader.then(result => {
      setDiff(result.ok ? result.data : '')
      setDiffLoading(false)
    })
  }, [selected])

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
    // stage 된 파일을 계속 보여주기 위해 selected를 staged로 전환
    if (selected?.path === file) {
      setSelected({ path: file, staged: true })
    }
  }

  const handleCommit = async () => {
    if (!message.trim()) return
    setCommitting(true)
    const result = await api.commit(message)
    setCommitting(false)
    if (result.ok) {
      setMessage('')
      setSelected(null)
      onCommitDone()
      await loadStatus()
      toast.success('커밋 완료')
    } else {
      toast.error(result.error)
    }
  }

  if (loading) return <div className="loading"><span className="spinner" /> 상태 로딩 중...</div>

  const staged = status?.staged || []
  const unstaged = [...(status?.modified || []), ...(status?.not_added || []), ...(status?.deleted || [])]
  // 중복 제거 (modified + staged 동시 발생 가능)
  const unstagedUnique = Array.from(new Set(unstaged))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minHeight: 0 }}>
      {/* Stash 아코디언 (기본 접힘) */}
      <StashAccordion onChanged={loadStatus} />

      {/* 좌: 파일 리스트 / 우: diff 미리보기 */}
      <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
        <div style={{ width: '40%', minWidth: '240px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Unstaged */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '12px', color: 'var(--text-muted)' }}>변경된 파일 ({unstagedUnique.length})</h3>
              {unstagedUnique.length > 0 && <button className="btn btn-sm" onClick={handleStageAll}>모두 Stage</button>}
            </div>
            {unstagedUnique.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px' }}>변경된 파일이 없습니다</div>
            ) : (
              <ul className="commit-list">
                {unstagedUnique.map(file => (
                  <li
                    key={`u-${file}`}
                    className={`commit-item ${selected?.path === file && !selected.staged ? 'selected' : ''}`}
                    onClick={() => setSelected({ path: file, staged: false })}
                    title="클릭하여 diff 보기"
                  >
                    <span style={{ color: 'var(--yellow)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>M</span>
                    <span className="commit-message" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{file}</span>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: '10px' }}
                      onClick={e => { e.stopPropagation(); handleStageFile(file) }}
                    >
                      + Stage
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Staged */}
          <div>
            <h3 style={{ fontSize: '12px', color: 'var(--green)', marginBottom: '8px' }}>Staged ({staged.length})</h3>
            {staged.length > 0 && (
              <ul className="commit-list">
                {staged.map(file => (
                  <li
                    key={`s-${file}`}
                    className={`commit-item ${selected?.path === file && selected.staged ? 'selected' : ''}`}
                    onClick={() => setSelected({ path: file, staged: true })}
                  >
                    <span style={{ color: 'var(--green)', fontSize: '11px' }}>✓</span>
                    <span className="commit-message" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{file}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 커밋 영역 */}
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

        {/* Diff 미리보기 */}
        <div style={{ flex: 1, overflow: 'auto', borderLeft: '1px solid var(--border)', paddingLeft: '12px', minWidth: 0 }}>
          {selected ? (
            <>
              <div style={{
                padding: '4px 8px',
                fontSize: '11px',
                color: selected.staged ? 'var(--green)' : 'var(--yellow)',
                fontFamily: 'var(--font-mono)',
                marginBottom: '4px'
              }}>
                {selected.staged ? '✓ Staged' : '● Unstaged'} · {selected.path}
              </div>
              {diffLoading ? (
                <div className="loading"><span className="spinner" /> diff 로딩 중...</div>
              ) : diff ? (
                <DiffView diff={diff} />
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '12px' }}>
                  diff 내용이 없습니다 (새 파일이거나 binary)
                </div>
              )}
            </>
          ) : (
            <div style={{
              padding: '32px 16px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center'
            }}>
              파일을 선택하면 diff가 표시됩니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}