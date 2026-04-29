import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { api, type StashEntry } from '../api'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmModal'

interface Props {
  /** stash 적용 / pop / drop / save 후 부모에게 변경 알림 (working tree 갱신용) */
  onChanged?: () => void
}

/**
 * 변경사항 탭 상단에 들어가는 컴팩트 Stash 아코디언.
 * 기본 접힘 → 클릭 시 펼침. + Stash 저장 폼 인라인. 각 stash에 Apply/Pop/Drop 버튼.
 * Diff 미리보기는 빼고 가벼운 리스트만 (자세한 stash 작업은 추후 별도 뷰).
 */
export function StashAccordion({ onChanged }: Props) {
  const toast = useToast()
  const confirm = useConfirm()
  const [stashes, setStashes] = useState<StashEntry[]>([])
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveMode, setSaveMode] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(false)

  const loadStashes = useCallback(async () => {
    const r = await api.stashList()
    if (r.ok) setStashes(r.data)
  }, [])

  useEffect(() => {
    loadStashes()
  }, [loadStashes])

  const handleSave = async () => {
    setBusy(true)
    const r = await api.stashSave(saveMessage || undefined, includeUntracked)
    setBusy(false)
    if (r.ok) {
      setSaveMode(false)
      setSaveMessage('')
      setIncludeUntracked(false)
      await loadStashes()
      onChanged?.()
      toast.success('Stash 저장됨')
    } else {
      toast.error(r.error)
    }
  }

  const handleApply = async (ref: string, pop: boolean) => {
    setBusy(true)
    const r = pop ? await api.stashPop(ref) : await api.stashApply(ref)
    setBusy(false)
    if (r.ok) {
      await loadStashes()
      onChanged?.()
      toast.success(pop ? `${ref} pop` : `${ref} apply`)
    } else {
      toast.error(r.error)
    }
  }

  const handleDrop = async (ref: string) => {
    const ok = await confirm({
      title: 'Stash 삭제',
      message: `${ref} 를 영구 삭제합니다. 되돌릴 수 없습니다.`,
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    setBusy(true)
    const r = await api.stashDrop(ref)
    setBusy(false)
    if (r.ok) {
      await loadStashes()
      toast.info(`${ref} 삭제됨`)
    } else {
      toast.error(r.error)
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'var(--bg-surface)',
        fontSize: 11,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(v => !v)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ color: 'var(--text-secondary)' }}>
          Stash <span style={{ color: 'var(--text-muted)' }}>({stashes.length})</span>
        </span>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-sm"
          onClick={(e) => {
            e.stopPropagation()
            setSaveMode(v => !v)
            setExpanded(true)
          }}
          disabled={busy}
          style={{ fontSize: 10, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Plus size={11} /> 저장
        </button>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '6px 10px' }}>
          {saveMode && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: stashes.length > 0 ? 8 : 0,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <input
                type="text"
                value={saveMessage}
                onChange={(e) => setSaveMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="메시지 (선택)"
                style={{ flex: 1, minWidth: 160, fontSize: 11, padding: '4px 6px' }}
                autoFocus
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={includeUntracked}
                  onChange={(e) => setIncludeUntracked(e.target.checked)}
                />
                untracked 포함
              </label>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={busy}
                style={{ fontSize: 10, padding: '2px 8px' }}
              >
                저장
              </button>
              <button
                className="btn btn-sm"
                onClick={() => { setSaveMode(false); setSaveMessage('') }}
                style={{ fontSize: 10, padding: '2px 6px' }}
              >
                취소
              </button>
            </div>
          )}

          {stashes.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
              저장된 stash가 없습니다
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stashes.map(s => (
                <li
                  key={s.refName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 6px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                  }}
                >
                  <code style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                    {s.refName}
                  </code>
                  {s.branch && (
                    <span style={{
                      background: 'var(--bg-hover)',
                      padding: '0 4px',
                      borderRadius: 3,
                      fontSize: 9,
                      color: 'var(--mauve)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {s.branch}
                    </span>
                  )}
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-primary)',
                  }}>
                    {s.message}
                  </span>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleApply(s.refName, false)}
                    disabled={busy}
                    style={{ fontSize: 10, padding: '2px 6px' }}
                  >
                    Apply
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleApply(s.refName, true)}
                    disabled={busy}
                    style={{ fontSize: 10, padding: '2px 6px' }}
                  >
                    Pop
                  </button>
                  <button
                    onClick={() => handleDrop(s.refName)}
                    disabled={busy}
                    aria-label={`${s.refName} 삭제`}
                    title="Drop"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--red)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
