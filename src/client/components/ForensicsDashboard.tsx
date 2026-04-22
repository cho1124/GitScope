import { useState, useEffect, type ReactNode } from 'react'
import { TrendingUp, Flame, Map as MapIcon, Users } from 'lucide-react'
import {
  api,
  type HeatmapEntry,
  type HotspotEntry,
  type TrendBucket,
  type ContributorInfo,
  type ProgressEvent,
} from '../api'
import { HeatmapCard } from './forensics/HeatmapCard'
import { HotspotCard } from './forensics/HotspotCard'
import { TrendChart } from './forensics/TrendChart'
import { ContributorCard } from './forensics/ContributorCard'
import { useToast } from './Toast'

type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading'; progress?: ProgressEvent }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: string }

interface CardMeta {
  title: string
  Icon: typeof TrendingUp
  color: string
}

function formatProgress(p: ProgressEvent | undefined): { text: string; ratio?: number } {
  if (!p) return { text: '로딩 중...' }
  switch (p.stage) {
    case 'cacheHit':
      return { text: '캐시 히트' }
    case 'counting':
      return { text: '커밋 수 세는 중...' }
    case 'scanning': {
      const { current, total } = p
      const ratio = total > 0 ? Math.min(1, current / total) : undefined
      const pct = ratio !== undefined ? ` (${Math.round(ratio * 100)}%)` : ''
      return {
        text: `${current.toLocaleString()} / ${total.toLocaleString()} 커밋 분석 중${pct}`,
        ratio,
      }
    }
    case 'aggregating':
      return { text: '집계 중...' }
  }
}

function ProgressBar({ ratio }: { ratio?: number }) {
  return (
    <div className="progress-bar">
      <div
        className={`progress-bar-fill ${ratio === undefined ? 'indeterminate' : ''}`}
        style={ratio !== undefined ? { width: `${ratio * 100}%` } : undefined}
      />
    </div>
  )
}

function CardWrapper({
  meta,
  state,
  children,
  onRetry,
  fullWidth,
}: {
  meta: CardMeta
  state: AsyncState<unknown>
  children: ReactNode
  onRetry?: () => void
  fullWidth?: boolean
}) {
  const HeaderIcon = meta.Icon
  const header = (
    <h3>
      <HeaderIcon size={14} color={meta.color} style={{ flexShrink: 0 }} />
      {meta.title}
    </h3>
  )
  if (state.status === 'loading') {
    const { text, ratio } = formatProgress(state.progress)
    return (
      <div className={`forensics-card ${fullWidth ? 'full-width' : ''}`}>
        {header}
        <div style={{ padding: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <span className="spinner" /> {text}
          </div>
          <ProgressBar ratio={ratio} />
        </div>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className={`forensics-card ${fullWidth ? 'full-width' : ''}`}>
        {header}
        <div style={{ padding: '16px', fontSize: '12px', color: 'var(--red)' }}>
          오류: {state.error}
          {onRetry && (
            <button className="btn btn-sm" onClick={onRetry} style={{ marginLeft: '8px' }}>
              재시도
            </button>
          )}
        </div>
      </div>
    )
  }
  return <>{children}</>
}

const cardMeta = {
  trend: { title: '변경 트렌드', Icon: TrendingUp, color: 'var(--accent)' } as CardMeta,
  hotspot: { title: '핫스팟', Icon: Flame, color: 'var(--red)' } as CardMeta,
  heatmap: { title: '변경 빈도 히트맵', Icon: MapIcon, color: 'var(--peach)' } as CardMeta,
  contributors: { title: '기여자 분석', Icon: Users, color: 'var(--mauve)' } as CardMeta,
}

export function ForensicsDashboard() {
  const toast = useToast()
  const [days, setDays] = useState(90)
  const [heatmapState, setHeatmapState] = useState<AsyncState<HeatmapEntry[]>>({ status: 'idle' })
  const [hotspotState, setHotspotState] = useState<AsyncState<HotspotEntry[]>>({ status: 'idle' })
  const [trendState, setTrendState] = useState<AsyncState<TrendBucket[]>>({ status: 'idle' })
  const [contributorState, setContributorState] = useState<AsyncState<ContributorInfo[]>>({
    status: 'idle',
  })

  const loadHeatmap = async (d: number) => {
    setHeatmapState({ status: 'loading' })
    const r = await api.getHeatmap({
      days: d,
      onProgress: e => setHeatmapState({ status: 'loading', progress: e }),
    })
    setHeatmapState(r.ok ? { status: 'ready', data: r.data } : { status: 'error', error: r.error })
  }

  const loadHotspots = async () => {
    setHotspotState({ status: 'loading' })
    const r = await api.getHotspots({
      limit: 15,
      onProgress: e => setHotspotState({ status: 'loading', progress: e }),
    })
    setHotspotState(r.ok ? { status: 'ready', data: r.data } : { status: 'error', error: r.error })
  }

  const loadTrend = async () => {
    setTrendState({ status: 'loading' })
    const r = await api.getTrend({
      days: 180,
      buckets: 12,
      onProgress: e => setTrendState({ status: 'loading', progress: e }),
    })
    setTrendState(r.ok ? { status: 'ready', data: r.data } : { status: 'error', error: r.error })
  }

  const loadContributors = async () => {
    setContributorState({ status: 'loading' })
    const r = await api.getContributors({
      onProgress: e => setContributorState({ status: 'loading', progress: e }),
    })
    if (r.ok) {
      setContributorState({ status: 'ready', data: r.data })
    } else {
      setContributorState({ status: 'error', error: r.error })
      toast.error(`기여자 분석 실패: ${r.error}`)
    }
  }

  // 메인 3종은 mount + days 변경 시 자동 로드 (각자 독립)
  useEffect(() => {
    loadHeatmap(days)
    loadHotspots()
    loadTrend()
    // 긴 시간 걸릴 수 있는 Contributors는 lazy — 사용자가 버튼 클릭
  }, [days])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Code Forensics</h2>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-primary)',
            padding: '4px 8px',
            fontSize: '11px',
          }}
        >
          <option value={30}>최근 30일</option>
          <option value={90}>최근 90일</option>
          <option value={180}>최근 180일</option>
          <option value={365}>최근 1년</option>
        </select>
      </div>

      <div className="forensics-grid">
        {/* Trend */}
        <CardWrapper meta={cardMeta.trend} state={trendState} onRetry={loadTrend} fullWidth>
          {trendState.status === 'ready' && <TrendChart data={trendState.data} />}
        </CardWrapper>

        {/* Hotspots */}
        <CardWrapper meta={cardMeta.hotspot} state={hotspotState} onRetry={loadHotspots}>
          {hotspotState.status === 'ready' && <HotspotCard hotspots={hotspotState.data} />}
        </CardWrapper>

        {/* Heatmap */}
        <CardWrapper
          meta={cardMeta.heatmap}
          state={heatmapState}
          onRetry={() => loadHeatmap(days)}
          fullWidth
        >
          {heatmapState.status === 'ready' && <HeatmapCard data={heatmapState.data} />}
        </CardWrapper>

        {/* Contributors — lazy load */}
        {contributorState.status === 'idle' ? (
          <div className="forensics-card">
            <h3>
              <Users size={14} color="var(--mauve)" style={{ flexShrink: 0 }} />
              기여자 분석
            </h3>
            <div style={{ padding: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
              큰 레포에서는 시간이 걸릴 수 있어 수동 로드로 분리했습니다.
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={loadContributors}
              style={{ width: '100%' }}
            >
              기여자 분석 로드
            </button>
          </div>
        ) : (
          <CardWrapper
            meta={cardMeta.contributors}
            state={contributorState}
            onRetry={loadContributors}
          >
            {contributorState.status === 'ready' && (
              <ContributorCard contributors={contributorState.data} />
            )}
          </CardWrapper>
        )}
      </div>
    </div>
  )
}