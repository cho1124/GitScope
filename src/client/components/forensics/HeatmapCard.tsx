interface HeatmapEntry {
  path: string
  changes: number
  insertions: number
  deletions: number
  authors: string[]
}

interface Props {
  data: HeatmapEntry[]
}

export function HeatmapCard({ data }: Props) {
  const maxChanges = data.length > 0 ? data[0].changes : 1
  const displayed = data.slice(0, 25)

  const getColor = (changes: number): string => {
    const ratio = changes / maxChanges
    if (ratio > 0.7) return 'var(--red)'
    if (ratio > 0.4) return 'var(--peach)'
    if (ratio > 0.2) return 'var(--yellow)'
    return 'var(--green)'
  }

  return (
    <div className="forensics-card full-width">
      <h3>
        <span>🗺️</span> 변경 빈도 히트맵
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
          (파일별 변경 횟수)
        </span>
      </h3>

      <ul className="heatmap-list">
        {displayed.map(entry => (
          <li key={entry.path} className="heatmap-item">
            <div
              className="heatmap-bar"
              style={{
                width: `${(entry.changes / maxChanges) * 120}px`,
                background: getColor(entry.changes)
              }}
            />
            <span className="heatmap-path" title={entry.path}>
              {entry.path}
            </span>
            <span className="heatmap-count">
              {entry.changes}회
            </span>
            <span className="heatmap-count" style={{ color: 'var(--green)' }}>
              +{entry.insertions}
            </span>
            <span className="heatmap-count" style={{ color: 'var(--red)' }}>
              -{entry.deletions}
            </span>
            <span className="heatmap-count">
              👤{entry.authors.length}
            </span>
          </li>
        ))}
      </ul>

      {data.length > 25 && (
        <div style={{ padding: '8px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
          외 {data.length - 25}개 파일...
        </div>
      )}
    </div>
  )
}