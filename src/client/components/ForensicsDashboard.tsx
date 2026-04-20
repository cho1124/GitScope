import { useState, useEffect } from 'react'
import { api } from '../api'
import { HeatmapCard } from './forensics/HeatmapCard'
import { HotspotCard } from './forensics/HotspotCard'
import { TrendChart } from './forensics/TrendChart'
import { ContributorCard } from './forensics/ContributorCard'

export function ForensicsDashboard() {
  const [heatmap, setHeatmap] = useState<any[]>([])
  const [hotspots, setHotspots] = useState<any[]>([])
  const [trend, setTrend] = useState<any[]>([])
  const [contributors, setContributors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(90)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getHeatmap({ days }),
      api.getHotspots({ limit: 15 }),
      api.getTrend({ days: 180, buckets: 12 }),
      api.getContributors()
    ]).then(([hm, hs, tr, ct]) => {
      if (hm.ok) setHeatmap(hm.data)
      if (hs.ok) setHotspots(hs.data)
      if (tr.ok) setTrend(tr.data)
      if (ct.ok) setContributors(ct.data)
      setLoading(false)
    })
  }, [days])

  if (loading) return <div className="loading"><span className="spinner" /> Forensics 분석 중...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Code Forensics</h2>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text-primary)', padding: '4px 8px', fontSize: '11px'
          }}
        >
          <option value={30}>최근 30일</option>
          <option value={90}>최근 90일</option>
          <option value={180}>최근 180일</option>
          <option value={365}>최근 1년</option>
        </select>
      </div>
      <div className="forensics-grid">
        <TrendChart data={trend} />
        <HotspotCard hotspots={hotspots} />
        <HeatmapCard data={heatmap} />
        <ContributorCard contributors={contributors} />
      </div>
    </div>
  )
}