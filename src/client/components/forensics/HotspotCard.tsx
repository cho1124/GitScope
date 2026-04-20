interface HotspotEntry {
  path: string
  score: number
  changes: number
  uniqueAuthors: number
  avgChangesPerCommit: number
  recentActivity: number
}

interface Props {
  hotspots: HotspotEntry[]
}

export function HotspotCard({ hotspots }: Props) {
  const getRankClass = (i: number): string => {
    if (i < 3) return 'hot'
    if (i < 7) return 'warm'
    return 'cool'
  }

  return (
    <div className="forensics-card">
      <h3>
        <span>🔥</span> 핫스팟
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
          (리팩토링 후보)
        </span>
      </h3>

      {hotspots.map((spot, i) => (
        <div key={spot.path} className="hotspot-item">
          <div className={`hotspot-rank ${getRankClass(i)}`}>
            {i + 1}
          </div>
          <div className="hotspot-info">
            <div className="hotspot-path" title={spot.path}>
              {spot.path}
            </div>
            <div className="hotspot-stats">
              변경 {spot.changes}회 · 기여자 {spot.uniqueAuthors}명 · 점수 {spot.score}
              {spot.recentActivity > 0 && (
                <span style={{ color: 'var(--red)', marginLeft: '4px' }}>● 최근 활발</span>
              )}
            </div>
          </div>
        </div>
      ))}

      {hotspots.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px' }}>
          데이터 없음
        </div>
      )}
    </div>
  )
}