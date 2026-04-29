import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Tag, Cherry, AlertTriangle, Play, X as XIcon, RotateCcw, AlertOctagon } from 'lucide-react'
import { api, type CommitInfo } from '../api'
import { buildGraph, maxLaneCount } from '../lib/graph'
import { CommitGraph } from './CommitGraph'
import { useConfirm } from './ConfirmModal'
import { useToast } from './Toast'

const GRAPH_LINE_HEIGHT = 36
const GRAPH_LANE_WIDTH = 14

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

interface CtxMenu {
  hash: string
  hashShort: string
  x: number
  y: number
  isMerge: boolean
}

function MenuButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '6px 10px',
        background: 'none',
        border: 'none',
        color: danger ? 'var(--red)' : 'var(--text-primary)',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 'calc(var(--radius) - 2px)',
        fontSize: '12px',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function CommitLog({ selectedCommit, onSelectCommit, file }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [cherryInProgress, setCherryInProgress] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  const confirm = useConfirm()
  const toast = useToast()

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

  const reload = useCallback(async () => {
    const target = Math.max(commits.length, PAGE_SIZE)
    const result = await api.getLog({ maxCount: target, file: file ?? undefined })
    if (result.ok) {
      setCommits(result.data)
      setReachedEnd(result.data.length < target)
    }
  }, [commits.length, file])

  const refreshCherryStatus = useCallback(async () => {
    const r = await api.cherryPickInProgress()
    setCherryInProgress(r.ok ? r.data : false)
  }, [])

  useEffect(() => {
    refreshCherryStatus()
  }, [refreshCherryStatus])

  // 컨텍스트 메뉴 외부 클릭/Esc 로 닫기
  useEffect(() => {
    if (!ctxMenu) return
    const onMouseDown = () => setCtxMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [ctxMenu])

  const handleCherryPick = async (target: CtxMenu) => {
    setCtxMenu(null)
    const mainline = target.isMerge ? 1 : undefined
    const message = target.isMerge
      ? `머지 커밋입니다. 첫 번째 부모(-m 1)를 기준으로 cherry-pick 합니다.\n\n${target.hashShort}`
      : `이 커밋을 현재 브랜치에 cherry-pick 합니다.\n\n${target.hashShort}`
    const ok = await confirm({
      title: 'Cherry-pick',
      message,
      variant: 'warn',
      confirmLabel: 'Cherry-pick',
    })
    if (!ok) return
    const result = await api.cherryPick(target.hash, { mainline })
    if (result.ok) {
      toast.success('Cherry-pick 완료')
    } else {
      toast.error(`Cherry-pick 실패: ${result.error}`)
    }
    await reload()
    await refreshCherryStatus()
  }

  const handleCherryAbort = async () => {
    const ok = await confirm({
      title: 'Cherry-pick 중단',
      message: '진행 중인 cherry-pick을 중단하고 이전 상태로 되돌립니다.',
      variant: 'danger',
      confirmLabel: '중단',
    })
    if (!ok) return
    const r = await api.cherryPickAbort()
    if (r.ok) {
      toast.info('Cherry-pick 중단됨')
    } else {
      toast.error(`중단 실패: ${r.error}`)
    }
    await reload()
    await refreshCherryStatus()
  }

  const handleCherryContinue = async () => {
    const r = await api.cherryPickContinue()
    if (r.ok) {
      toast.success('Cherry-pick 계속 완료')
    } else {
      toast.error(`계속 실패: ${r.error}`)
    }
    await reload()
    await refreshCherryStatus()
  }

  const handleReset = async (target: CtxMenu, mode: 'soft' | 'mixed' | 'hard') => {
    setCtxMenu(null)
    const variant = mode === 'hard' ? 'danger' : 'warn'
    const description: Record<typeof mode, string> = {
      soft: '현재 HEAD만 이 커밋으로 이동합니다. staging과 working tree의 변경사항은 그대로 보존됩니다.',
      mixed: '현재 HEAD를 이 커밋으로 이동하고 staging을 비웁니다. working tree의 변경사항은 보존됩니다.',
      hard: '⚠️ HEAD / staging / working tree 를 모두 이 커밋 상태로 되돌립니다.\n\n커밋되지 않은 모든 변경사항이 영구적으로 사라집니다.',
    }
    const ok = await confirm({
      title: `Reset (${mode})`,
      message: `${description[mode]}\n\n대상: ${target.hashShort}`,
      variant,
      confirmLabel: mode === 'hard' ? 'Hard reset' : `Reset (${mode})`,
    })
    if (!ok) return
    const result = await api.reset(target.hash, mode)
    if (result.ok) {
      toast.success(`Reset (${mode}) 완료`)
    } else {
      toast.error(`Reset 실패: ${result.error}`)
    }
    await reload()
  }

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

  // 그래프 레인 계산
  const graphRows = useMemo(() => buildGraph(commits), [commits])
  const laneCount = useMemo(() => maxLaneCount(graphRows), [graphRows])

  if (loading) return <div className="loading"><span className="spinner" /> 커밋 로딩 중...</div>
  if (commits.length === 0) return <div className="loading">커밋이 없습니다</div>

  return (
    <>
      {cherryInProgress && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'rgba(249, 226, 175, 0.12)',
          borderBottom: '1px solid var(--yellow)',
          borderLeft: '3px solid var(--yellow)',
          fontSize: '12px',
          color: 'var(--text-primary)',
        }}>
          <AlertTriangle size={14} strokeWidth={2.5} color="var(--yellow)" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Cherry-pick 진행 중. 충돌이 있으면 해결한 뒤 계속하세요.</span>
          <button
            className="btn btn-sm"
            onClick={handleCherryContinue}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Play size={11} strokeWidth={2.5} /> 계속
          </button>
          <button
            className="btn btn-sm"
            onClick={handleCherryAbort}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'var(--red)',
              color: 'var(--bg-primary)',
              borderColor: 'var(--red)',
            }}
          >
            <XIcon size={11} strokeWidth={2.5} /> 중단
          </button>
        </div>
      )}
      <ul
        ref={listRef}
        className="commit-list"
        tabIndex={0}
        role="listbox"
        aria-label="커밋 목록 (↑/↓ 또는 j/k 로 이동)"
      >
        {commits.map((commit, idx) => {
          const parsed = parseRefs(commit.refs)
          const isSelected = selectedCommit === commit.hash
          const graphRow = graphRows[idx]
          return (
            <li
              key={commit.hash}
              data-hash={commit.hash}
              className={`commit-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectCommit(commit.hash)}
              onContextMenu={(e) => {
                e.preventDefault()
                setCtxMenu({
                  hash: commit.hash,
                  hashShort: commit.hashShort,
                  x: e.clientX,
                  y: e.clientY,
                  isMerge: commit.parents.length >= 2,
                })
              }}
              role="option"
              aria-selected={isSelected}
            >
              {graphRow && (
                <CommitGraph
                  row={graphRow}
                  commitHash={commit.hash}
                  laneCount={laneCount}
                  laneWidth={GRAPH_LANE_WIDTH}
                  lineHeight={GRAPH_LINE_HEIGHT}
                />
              )}
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

      {/* 우클릭 컨텍스트 메뉴 */}
      {ctxMenu && (
        <div
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            padding: '4px',
            minWidth: '180px',
            zIndex: 9000,
            fontSize: '12px',
          }}
        >
          <MenuButton
            icon={<Cherry size={13} strokeWidth={2.5} color="var(--red)" />}
            label={`Cherry-pick${ctxMenu.isMerge ? ' (merge, -m 1)' : ''}`}
            onClick={() => handleCherryPick(ctxMenu)}
          />

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <MenuButton
            icon={<RotateCcw size={13} strokeWidth={2.5} color="var(--yellow)" />}
            label="Reset (soft) — 변경사항 보존"
            onClick={() => handleReset(ctxMenu, 'soft')}
          />
          <MenuButton
            icon={<RotateCcw size={13} strokeWidth={2.5} color="var(--yellow)" />}
            label="Reset (mixed) — staging 비움"
            onClick={() => handleReset(ctxMenu, 'mixed')}
          />
          <MenuButton
            icon={<AlertOctagon size={13} strokeWidth={2.5} color="var(--red)" />}
            label="Reset (hard) — 모든 변경 삭제"
            onClick={() => handleReset(ctxMenu, 'hard')}
            danger
          />
        </div>
      )}
    </>
  )
}