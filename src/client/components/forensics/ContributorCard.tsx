import { useState } from 'react'

interface ContributorInfo {
  name: string
  email: string
  commits: number
  filesOwned: string[]
  topFiles: { path: string; changes: number }[]
}

interface Props {
  contributors: ContributorInfo[]
}

export function ContributorCard({ contributors }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const maxCommits = contributors.length > 0 ? contributors[0].commits : 1

  return (
    <div className="forensics-card">
      <h3>
        <span>👥</span> 기여자 분석
      </h3>

      {contributors.slice(0, 10).map(c => (
        <div key={c.name} style={{ marginBottom: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '4px 0'
            }}
            onClick={() => setExpanded(expanded === c.name ? null : c.name)}
          >
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--bg-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent)'
            }}>
              {c.name.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {c.commits}커밋 · {c.filesOwned.length}개 주요 파일
              </div>
            </div>

            <div style={{
              width: `${(c.commits / maxCommits) * 60}px`,
              height: '4px',
              background: 'var(--accent)',
              borderRadius: '2px'
            }} />
          </div>

          {expanded === c.name && (
            <div style={{
              marginLeft: '36px',
              padding: '4px 0',
              fontSize: '11px'
            }}>
              {c.topFiles.slice(0, 5).map(f => (
                <div key={f.path} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '2px 0',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px'
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.path}
                  </span>
                  <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>
                    {f.changes}회
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {contributors.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px' }}>
          데이터 없음
        </div>
      )}
    </div>
  )
}