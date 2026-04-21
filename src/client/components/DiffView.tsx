import { useMemo } from 'react'
import { List, type RowComponentProps } from 'react-window'

interface Props {
  diff: string
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

export function DiffView({ diff }: Props) {
  const lines = useMemo<DiffLine[]>(() => {
    if (!diff) return []
    return diff.split('\n').map(text => ({ text, className: classify(text) }))
  }, [diff])

  if (!diff) {
    return <div className="loading">커밋을 선택하면 diff를 표시합니다</div>
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