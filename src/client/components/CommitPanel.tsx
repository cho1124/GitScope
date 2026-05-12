import { useState, useEffect, useCallback } from 'react'
import { api, type StatusInfo } from '../api'
import { DiffView } from './DiffView'
import { useToast } from './Toast'
import { StashAccordion } from './StashAccordion'

interface Props {
  onCommitDone: () => void
}

/**
 * 선택 상태 — 다중 선택(Ctrl/Shift) 지원.
 * - staged: 어느 그룹의 선택인지 (null = 미선택)
 * - paths: 선택된 파일들
 * - anchor: 마지막 클릭 (diff 표시 기준 + Shift 범위의 anchor)
 */
interface Selection {
  staged: boolean | null
  paths: Set<string>
  anchor: string | null
}

const EMPTY_SELECTION: Selection = { staged: null, paths: new Set<string>(), anchor: null }

export function CommitPanel({ onCommitDone }: Props) {
  const toast = useToast()
  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [committing, setCommitting] = useState(false)
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION)
  const [diff, setDiff] = useState<string>('')
  const [diffLoading, setDiffLoading] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    const result = await api.getStatus()
    if (result.ok) setStatus(result.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // anchor(마지막 클릭)의 diff 로드
  useEffect(() => {
    if (!selection.anchor || selection.staged === null) {
      setDiff('')
      return
    }
    const file = selection.anchor
    const stagedFlag = selection.staged
    setDiffLoading(true)
    const loader = stagedFlag ? api.getStagedDiff(file) : api.getUnstagedDiff(file)
    loader.then(result => {
      setDiff(result.ok ? result.data : '')
      setDiffLoading(false)
    })
  }, [selection.anchor, selection.staged])

  /**
   * 파일 리스트 클릭 처리:
   * - 일반 클릭: 단일 선택 (anchor=클릭)
   * - Ctrl/⌘ 클릭: 같은 그룹이면 toggle, 다른 그룹이면 새로 시작
   * - Shift 클릭: 같은 그룹이면 anchor~클릭 범위 추가
   */
  const handleFileClick = useCallback((
    file: string,
    staged: boolean,
    e: React.MouseEvent,
    groupFiles: string[],
  ) => {
    setSelection(prev => {
      // Shift 범위 — anchor 가 같은 그룹일 때만
      if (e.shiftKey && prev.anchor && prev.staged === staged) {
        const a = groupFiles.indexOf(prev.anchor)
        const b = groupFiles.indexOf(file)
        if (a >= 0 && b >= 0) {
          const [start, end] = a < b ? [a, b] : [b, a]
          const next = new Set(prev.paths)
          for (let i = start; i <= end; i++) next.add(groupFiles[i])
          return { staged, paths: next, anchor: file }
        }
      }
      // Ctrl/⌘ toggle — 같은 그룹일 때만 누적
      if ((e.ctrlKey || e.metaKey) && prev.staged === staged) {
        const next = new Set(prev.paths)
        if (next.has(file)) next.delete(file)
        else next.add(file)
        if (next.size === 0) return EMPTY_SELECTION
        return { staged, paths: next, anchor: file }
      }
      // 일반 클릭 — 단일 선택
      return { staged, paths: new Set([file]), anchor: file }
    })
  }, [])

  const handleStageAll = async () => {
    if (!status) return
    const files = [...(status.not_added || []), ...(status.modified || []), ...(status.deleted || [])]
    if (files.length === 0) return
    await api.stage(files)
    await loadStatus()
  }

  const handleUnstageAll = async () => {
    if (!status || !status.staged.length) return
    await api.unstage(status.staged)
    await loadStatus()
  }

  /** 다중 선택된 unstaged 파일들 한 번에 stage */
  const handleStageSelected = async () => {
    if (selection.staged !== false || selection.paths.size === 0) return
    const files = Array.from(selection.paths)
    const r = await api.stage(files)
    if (!r.ok) {
      toast.error(`Stage 실패: ${r.error}`)
      return
    }
    await loadStatus()
    // 같은 파일들이 staged 그룹으로 이동 — 선택 그대로 따라감
    setSelection({ staged: true, paths: new Set(files), anchor: selection.anchor })
    toast.success(`${files.length}개 파일 Stage`)
  }

  /** 다중 선택된 staged 파일들 한 번에 unstage */
  const handleUnstageSelected = async () => {
    if (selection.staged !== true || selection.paths.size === 0) return
    const files = Array.from(selection.paths)
    const r = await api.unstage(files)
    if (!r.ok) {
      toast.error(`Unstage 실패: ${r.error}`)
      return
    }
    await loadStatus()
    setSelection({ staged: false, paths: new Set(files), anchor: selection.anchor })
    toast.success(`${files.length}개 파일 Unstage`)
  }

  const handleStageFile = async (file: string) => {
    await api.stage([file])
    await loadStatus()
    setSelection(prev => {
      if (prev.anchor === file) {
        // 클릭한 anchor 파일을 stage → diff 도 staged 로 전환, 다중 선택 해제
        return { staged: true, paths: new Set([file]), anchor: file }
      }
      // 다른 파일(다중 선택 중 한 개) — 해당 파일만 selection 에서 제거
      const next = new Set(prev.paths)
      next.delete(file)
      if (next.size === 0) return EMPTY_SELECTION
      return { ...prev, paths: next }
    })
  }

  const handleUnstageFile = async (file: string) => {
    await api.unstage([file])
    await loadStatus()
    setSelection(prev => {
      if (prev.anchor === file) {
        return { staged: false, paths: new Set([file]), anchor: file }
      }
      const next = new Set(prev.paths)
      next.delete(file)
      if (next.size === 0) return EMPTY_SELECTION
      return { ...prev, paths: next }
    })
  }

  /** diff reload 후 status reload (hunk staging 직후 호출) */
  const reloadAfterPatch = useCallback(async () => {
    if (!selection.anchor || selection.staged === null) {
      await loadStatus()
      return
    }
    const file = selection.anchor
    const stagedFlag = selection.staged
    const loader = stagedFlag ? api.getStagedDiff(file) : api.getUnstagedDiff(file)
    const [diffRes] = await Promise.all([loader, loadStatus()])
    setDiff(diffRes.ok ? diffRes.data : '')
  }, [selection.anchor, selection.staged, loadStatus])

  const handleStageHunk = useCallback(async (patch: string) => {
    const r = await api.applyPatchCached(patch, false)
    if (r.ok) {
      toast.success('hunk 적용')
      await reloadAfterPatch()
    } else {
      toast.error(`Stage hunk 실패: ${r.error}`)
    }
  }, [reloadAfterPatch, toast])

  const handleUnstageHunk = useCallback(async (patch: string) => {
    const r = await api.applyPatchCached(patch, true)
    if (r.ok) {
      toast.success('hunk 되돌림')
      await reloadAfterPatch()
    } else {
      toast.error(`Unstage hunk 실패: ${r.error}`)
    }
  }, [reloadAfterPatch, toast])

  const handleCommit = async () => {
    if (!message.trim()) return
    setCommitting(true)
    const result = await api.commit(message)
    setCommitting(false)
    if (result.ok) {
      setMessage('')
      setSelection(EMPTY_SELECTION)
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

  const unstagedSelectedCount = selection.staged === false ? selection.paths.size : 0
  const stagedSelectedCount = selection.staged === true ? selection.paths.size : 0

  const anchorPath = selection.anchor
  const anchorStaged = selection.staged === true

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minHeight: 0 }}>
      {/* Stash 아코디언 (기본 접힘) */}
      <StashAccordion onChanged={loadStatus} />

      {/* 좌: 파일 리스트 / 우: diff 미리보기 */}
      <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
        <div style={{ width: '40%', minWidth: '240px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Unstaged */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: 6 }}>
              <h3 style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                변경된 파일 ({unstagedUnique.length})
                {unstagedSelectedCount > 0 && (
                  <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· {unstagedSelectedCount}개 선택</span>
                )}
              </h3>
              {unstagedUnique.length > 0 && (
                unstagedSelectedCount > 1 ? (
                  <button className="btn btn-sm" onClick={handleStageSelected} title="선택한 파일만 Stage">
                    선택한 {unstagedSelectedCount}개 Stage
                  </button>
                ) : (
                  <button className="btn btn-sm" onClick={handleStageAll}>모두 Stage</button>
                )
              )}
            </div>
            {unstagedUnique.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px' }}>변경된 파일이 없습니다</div>
            ) : (
              <ul className="commit-list" style={{ userSelect: 'none' }}>
                {unstagedUnique.map(file => {
                  const isSelected = selection.staged === false && selection.paths.has(file)
                  const isAnchor = !anchorStaged && anchorPath === file
                  return (
                    <li
                      key={`u-${file}`}
                      className={`commit-item ${isSelected ? 'selected' : ''}`}
                      onMouseDown={(e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault() }}
                      onClick={(e) => handleFileClick(file, false, e, unstagedUnique)}
                      title="클릭 = 단일 / Ctrl+클릭 = 다중 / Shift+클릭 = 범위"
                      style={isAnchor ? { borderLeft: '3px solid var(--accent)' } : undefined}
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
                  )
                })}
              </ul>
            )}
          </div>

          {/* Staged */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: 6 }}>
              <h3 style={{ fontSize: '12px', color: 'var(--green)' }}>
                Staged ({staged.length})
                {stagedSelectedCount > 0 && (
                  <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· {stagedSelectedCount}개 선택</span>
                )}
              </h3>
              {staged.length > 0 && (
                stagedSelectedCount > 1 ? (
                  <button className="btn btn-sm" onClick={handleUnstageSelected} title="선택한 파일만 Unstage">
                    선택한 {stagedSelectedCount}개 Unstage
                  </button>
                ) : (
                  <button className="btn btn-sm" onClick={handleUnstageAll}>모두 Unstage</button>
                )
              )}
            </div>
            {staged.length > 0 && (
              <ul className="commit-list" style={{ userSelect: 'none' }}>
                {staged.map(file => {
                  const isSelected = selection.staged === true && selection.paths.has(file)
                  const isAnchor = anchorStaged && anchorPath === file
                  return (
                    <li
                      key={`s-${file}`}
                      className={`commit-item ${isSelected ? 'selected' : ''}`}
                      onMouseDown={(e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault() }}
                      onClick={(e) => handleFileClick(file, true, e, staged)}
                      title="클릭 = 단일 / Ctrl+클릭 = 다중 / Shift+클릭 = 범위"
                      style={isAnchor ? { borderLeft: '3px solid var(--accent)' } : undefined}
                    >
                      <span style={{ color: 'var(--green)', fontSize: '11px' }}>✓</span>
                      <span className="commit-message" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{file}</span>
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: '10px' }}
                        onClick={e => { e.stopPropagation(); handleUnstageFile(file) }}
                        title="이 파일 unstaging"
                      >
                        − Unstage
                      </button>
                    </li>
                  )
                })}
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
          {anchorPath && selection.staged !== null ? (
            <>
              <div style={{
                padding: '4px 8px',
                fontSize: '11px',
                color: anchorStaged ? 'var(--green)' : 'var(--yellow)',
                fontFamily: 'var(--font-mono)',
                marginBottom: '4px'
              }}>
                {anchorStaged ? '✓ Staged' : '● Unstaged'} · {anchorPath}
                {selection.paths.size > 1 && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                    (다중 선택 {selection.paths.size}개 — anchor diff 표시)
                  </span>
                )}
              </div>
              {diffLoading ? (
                <div className="loading"><span className="spinner" /> diff 로딩 중...</div>
              ) : diff ? (
                <DiffView
                  diff={diff}
                  onStageHunk={anchorStaged ? undefined : handleStageHunk}
                  onUnstageHunk={anchorStaged ? handleUnstageHunk : undefined}
                />
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
              <div style={{ fontSize: '10px', marginTop: 6 }}>
                Ctrl/Shift+클릭으로 다중 선택
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}