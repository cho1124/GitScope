import { useMemo } from 'react'
import { List, type RowComponentProps } from 'react-window'
import { parseDiff, buildHunkPatch, type DiffFile, type DiffHunk } from '../lib/diffPatch'

interface Props {
  diff: string
  /** unstaged → staged 부분 적용. 정의 시 각 hunk 위에 "Stage hunk" 버튼 노출 */
  onStageHunk?: (patch: string) => void | Promise<void>
  /** staged → unstaged 부분 되돌리기. 정의 시 각 hunk 위에 "Unstage hunk" 버튼 노출 */
  onUnstageHunk?: (patch: string) => void | Promise<void>
}

const LINE_HEIGHT = 19
const VIRTUALIZE_THRESHOLD = 400

interface DiffLine {
  text: string
  className: string
}

function classify(line: string): string {
  if (line.startsWith('diff --git') || line.startsWith('index ')) return 'diff-header'
  if (line.startsWith('+++') || line.startsWith('---')) return 'diff-header'
  if (line.startsWith('@@')) return 'diff-hunk'
  if (line.startsWith('+')) return 'diff-add'
  if (line.startsWith('-')) return 'diff-del'
  return ''
}

type RowProps = { lines: DiffLine[] }

function Row({ index, style, lines }: RowComponentProps<RowProps>) {
  const line = lines[index]
  return (
    <div
      className={line.className}
      style={{
        ...style,
        whiteSpace: 'pre',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        paddingLeft: 12,
        paddingRight: 12
      }}
    >
      {line.text || '\u00A0'}
    </div>
  )
}

export function DiffView({ diff, onStageHunk, onUnstageHunk }: Props) {
  const lines = useMemo<DiffLine[]>(() => {
    if (!diff) return []
    return diff.split('\n').map(text => ({ text, className: classify(text) }))
  }, [diff])

  // hunk staging 모드 — diff 파싱 후 파일+hunk 단위 렌더
  const files = useMemo<DiffFile[]>(() => {
    if (!diff || (!onStageHunk && !onUnstageHunk)) return []
    return parseDiff(diff)
  }, [diff, onStageHunk, onUnstageHunk])

  if (!diff) {
    return <div className="loading">커밋을 선택하면 diff를 표시합니다</div>
  }

  // hunk staging 모드 — 큰 diff 여도 hunk 단위 렌더 (virtualize 미적용)
  if ((onStageHunk || onUnstageHunk) && files.length > 0) {
    return (
      <div className="diff-view" style={{ padding: '8px 12px' }}>
        {files.map((file, fIdx) => (
          <div key={`f-${fIdx}`} style={{ marginBottom: 8 }}>
            {file.header.map((h, hIdx) => (
              <div key={`fh-${fIdx}-${hIdx}`} className="diff-header">{h}</div>
            ))}
            {file.hunks.map((hunk, hIdx) => (
              <HunkBlock
                key={`h-${fIdx}-${hIdx}`}
                hunk={hunk}
                onStage={onStageHunk ? () => onStageHunk(buildHunkPatch(file, hunk)) : undefined}
                onUnstage={onUnstageHunk ? () => onUnstageHunk(buildHunkPatch(file, hunk)) : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // 작은 diff는 일반 렌더링 (복사/드래그 friendly)
  if (lines.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div className="diff-view" style={{ padding: '8px 12px' }}>
        {lines.map((line, i) => (
          <div key={i} className={line.className}>{line.text}</div>
        ))}
      </div>
    )
  }

  // 큰 diff는 virtualize
  return (
    <div className="diff-view" style={{ height: '100%', width: '100%', position: 'relative' }}>
      <List
        rowComponent={Row}
        rowCount={lines.length}
        rowHeight={LINE_HEIGHT}
        rowProps={{ lines }}
        overscanCount={10}
        style={{ height: '100%', width: '100%' }}
      />
      <div style={{
        position: 'absolute',
        top: 4, right: 8,
        fontSize: 10,
        color: 'var(--text-muted)',
        background: 'var(--bg-secondary)',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        pointerEvents: 'none'
      }}>
        virtualized · {lines.length.toLocaleString()} lines
      </div>
    </div>
  )
}

function HunkBlock({
  hunk,
  onStage,
  onUnstage,
}: {
  hunk: DiffHunk
  onStage?: () => void | Promise<void>
  onUnstage?: () => void | Promise<void>
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--bg-surface)',
          padding: '2px 8px',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          className="diff-hunk"
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={hunk.headerLine}
        >
          {hunk.headerLine}
        </span>
        {onStage && (
          <button
            type="button"
            className="btn btn-sm"
            style={{
              fontSize: 10,
              padding: '2px 8px',
              background: 'var(--green)',
              color: 'var(--bg-primary)',
              borderColor: 'var(--green)',
            }}
            onClick={onStage}
            title="이 hunk만 staging"
          >
            + Stage hunk
          </button>
        )}
        {onUnstage && (
          <button
            type="button"
            className="btn btn-sm"
            style={{ fontSize: 10, padding: '2px 8px' }}
            onClick={onUnstage}
            title="이 hunk만 unstaging"
          >
            − Unstage hunk
          </button>
        )}
      </div>
      {hunk.lines.slice(1).map((line, i) => (
        <div key={i} className={classify(line)}>{line}</div>
      ))}
    </div>
  )
}