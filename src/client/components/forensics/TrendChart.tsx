interface TrendBucket {
  label: string
  commits: number
  filesChanged: number
  insertions: number
  deletions: number
}

interface Props {
  data: TrendBucket[]
}

export function TrendChart({ data }: Props) {
  const maxCommits = Math.max(...data.map(d => d.commits), 1)
  const maxChurn = Math.max(...data.map(d => d.insertions + d.deletions), 1)

  return (
    <div className="forensics-card full-width">
      <h3>
        <span>📈</span> 변경 트렌드
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
          (시간축 변경 추이)
        </span>
      </h3>

      {/* Bar chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px', padding: '8px 0' }}>
        {data.map((bucket, i) => {
          const commitH = (bucket.commits / maxCommits) * 100
          const churnH = ((bucket.insertions + bucket.deletions) / maxChurn) * 80

          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                height: '100%',
                justifyContent: 'flex-end'
              }}
              title={`${bucket.label}\n커밋: ${bucket.commits}\n파일: ${bucket.filesChanged}\n+${bucket.insertions} -${bucket.deletions}`}
            >
              {/* Churn bar (behind) */}
              <div style={{
                width: '100%',
                height: `${churnH}%`,
                background: 'rgba(137, 180, 250, 0.15)',
                borderRadius: '3px 3px 0 0',
                position: 'relative'
              }}>
                {/* Commit bar (front) */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '25%',
                  width: '50%',
                  height: `${commitH}%`,
                  background: 'var(--accent)',
                  borderRadius: '2px 2px 0 0',
                  minHeight: bucket.commits > 0 ? '2px' : 0
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {data.map((bucket, i) => (
          <div key={i} style={{
            flex: 1,
            textAlign: 'center',
            fontSize: '9px',
            color: 'var(--text-muted)'
          }}>
            {bucket.label}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', background: 'var(--accent)', borderRadius: '2px' }} />
          <span style={{ color: 'var(--text-muted)' }}>커밋 수</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', background: 'rgba(137, 180, 250, 0.15)', borderRadius: '2px' }} />
          <span style={{ color: 'var(--text-muted)' }}>코드 변동량</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginTop: '12px',
        padding: '8px 12px',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius)',
        fontSize: '11px'
      }}>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>총 커밋</div>
          <div style={{ fontWeight: 600 }}>{data.reduce((s, d) => s + d.commits, 0)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>총 파일 변경</div>
          <div style={{ fontWeight: 600 }}>{data.reduce((s, d) => s + d.filesChanged, 0)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--green)' }}>추가</div>
          <div style={{ fontWeight: 600, color: 'var(--green)' }}>+{data.reduce((s, d) => s + d.insertions, 0).toLocaleString()}</div>
        </div>
        <div>
          <div style={{ color: 'var(--red)' }}>삭제</div>
          <div style={{ fontWeight: 600, color: 'var(--red)' }}>-{data.reduce((s, d) => s + d.deletions, 0).toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}