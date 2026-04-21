import { useState, useEffect, useCallback } from 'react'
import { api, type StashEntry } from '../api'
import { DiffView } from './DiffView'

interface Props {
  onStashChanged?: () => void
}

export function StashPanel({ onStashChanged }: Props) {
  const [stashes, setStashes] = useState<StashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedDiff, setSelectedDiff] = useState<string>('')
  const [saveMode, setSaveMode] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(false)

  const loadStashes = useCallback(async () => {
    setLoading(true)
    const result = await api.stashList()
    if (result.ok) setStashes(result.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadStashes()
  }, [loadStashes])

  const handleSelect = async (ref: string) => {
    setSelected(ref)
    setSelectedDiff('')
    const result = await api.stashShow(ref)
    if (result.ok) setSelectedDiff(result.data)
  }

  const handleSave = async () => {
    setBusy(true)
    const result = await api.stashSave(saveMessage || undefined, includeUntracked)
    setBusy(false)
    if (result.ok) {
      setSaveMode(false)
      setSaveMessage('')
      setIncludeUntracked(false)
      await loadStashes()
      onStashChanged?.()
    } else {
      alert(result.error)
    }
  }

  const handleApply = async (ref: string, pop: boolean) => {
    setBusy(true)
    const result = pop ? await api.stashPop(ref) : await api.stashApply(ref)
    setBusy(false)
    if (result.ok) {
      if (pop) {
        setSelected(null)
        setSelectedDiff('')
      }
      await loadStashes()
      onStashChanged?.()
    } else {
      alert(result.error)
    }
  }

  const handleDrop = async (ref: string) => {
    if (!confirm(`${ref} 를 삭제할까요?`)) return
    setBusy(true)
    const result = await api.stashDrop(ref)
    setBusy(false)
    if (result.ok) {
      if (selected === ref) {
        setSelected(null)
        setSelectedDiff('')
      }
      await loadStashes()
      onStashChanged?.()
    } else {
      alert(result.error)
    }
  }

  if (loading) {
    return <div className="loading"><span className="spinner" /> Stash 로딩 중...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <h3 style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Stash ({stashes.length})
        </h3>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={loadStashes} disabled={busy}>새로고침</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setSaveMode(v => !v)}
          disabled={busy}
        >
          + Stash 저장
        </button>
      </div>

      {/* 저장 모달 */}
      {saveMode && (
        <div style={{
          padding: '12px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)'
        }}>
          <input
            type="text"
            value={saveMessage}
            onChange={e => setSaveMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="메시지 (선택사항)"
            style={{ width: '100%', marginBottom: '8px' }}
            autoFocus
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={includeUntracked}
              onChange={e => setIncludeUntracked(e.target.checked)}
            />
            Untracked 파일 포함 (--include-untracked)
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={busy}>
              저장
            </button>
            <button className="btn btn-sm" onClick={() => setSaveMode(false)}>취소</button>
          </div>
        </div>
      )}

      {/* 리스트 */}
      <div style={{ display: 'flex', gap: '12px', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '40%', overflow: 'auto', minWidth: '200px' }}>
          {stashes.length === 0 ? (
            <div style={{
              padding: '16px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius)'
            }}>
              저장된 stash가 없습니다
            </div>
          ) : (
            <ul className="commit-list">
              {stashes.map(s => (
                <li
                  key={s.refName}
                  className={`commit-item ${selected === s.refName ? 'selected' : ''}`}
                  onClick={() => handleSelect(s.refName)}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <span className="commit-hash">{s.refName}</span>
                    {s.branch && (
                      <span style={{
                        background: 'var(--bg-hover)',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        color: 'var(--mauve)',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {s.branch}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)', width: '100%' }}>
                    {s.message}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                      onClick={e => { e.stopPropagation(); handleApply(s.refName, false) }}
                      disabled={busy}
                    >
                      Apply
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                      onClick={e => { e.stopPropagation(); handleApply(s.refName, true) }}
                      disabled={busy}
                    >
                      Pop
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: '10px', padding: '2px 6px', color: 'var(--red)' }}
                      onClick={e => { e.stopPropagation(); handleDrop(s.refName) }}
                      disabled={busy}
                    >
                      Drop
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Diff 미리보기 */}
        <div style={{ flex: 1, overflow: 'auto', borderLeft: '1px solid var(--border)', paddingLeft: '12px' }}>
          {selected ? (
            selectedDiff ? (
              <DiffView diff={selectedDiff} />
            ) : (
              <div className="loading"><span className="spinner" /> diff 로딩 중...</div>
            )
          ) : (
            <div style={{
              padding: '32px 16px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center'
            }}>
              stash를 선택하면 diff가 표시됩니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}