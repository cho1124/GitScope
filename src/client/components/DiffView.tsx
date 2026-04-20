interface Props {
  diff: string
}

export function DiffView({ diff }: Props) {
  if (!diff) return <div className="loading">커밋을 선택하면 diff를 표시합니다</div>

  const lines = diff.split('\n')

  return (
    <div className="diff-view" style={{ padding: '8px 12px' }}>
      {lines.map((line, i) => {
        let className = ''
        if (line.startsWith('diff --git') || line.startsWith('index ')) className = 'diff-header'
        else if (line.startsWith('+++') || line.startsWith('---')) className = 'diff-header'
        else if (line.startsWith('@@')) className = 'diff-hunk'
        else if (line.startsWith('+')) className = 'diff-add'
        else if (line.startsWith('-')) className = 'diff-del'
        return <div key={i} className={className}>{line}</div>
      })}
    </div>
  )
}