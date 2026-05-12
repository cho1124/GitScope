import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react'
import { api } from '../api'

/**
 * 핫 페퍼 배지용 핫스팟 score map.
 *
 * 백엔드 `get_hotspots` 의 score 공식
 * `changes × 3 + authors × 5 + churn × 0.01 + recent × 10`
 * 을 그대로 재사용. limit 을 크게(1000) 호출해서 전체 파일 분포를 받음.
 *
 * Percentile 기반 매운맛 등급:
 *  - level 1 (🌶️)   : 상위 33%
 *  - level 2 (🌶️🌶️) : 상위 10%
 *  - level 3 (🌶️🌶️🌶️): 상위 3%
 *
 * 페퍼 Lean Principle 부합: 새 IPC X, 새 데이터 X, 기존 forensics 캐시 재활용.
 */

export type SpiceLevel = 0 | 1 | 2 | 3

interface HotspotContextValue {
  /** 파일 경로 → 매운맛 등급. 데이터 없으면 0 반환. */
  getLevel: (path: string) => SpiceLevel
  /** 최초 로드 중 여부 (UI 에서 사용 안 해도 됨 — silent fail) */
  loading: boolean
}

const HotspotContext = createContext<HotspotContextValue>({
  getLevel: () => 0,
  loading: false,
})

interface ScoreMap {
  scores: Map<string, number>
  threshold33: number
  threshold10: number
  threshold3: number
}

const EMPTY: ScoreMap = {
  scores: new Map(),
  threshold33: Infinity,
  threshold10: Infinity,
  threshold3: Infinity,
}

interface ProviderProps {
  /** 현재 레포 경로. 변경 시 재 fetch. */
  repoPath: string
  /** 명시적 새로고침 키. 변경 시 재 fetch. */
  refreshKey?: number
  children: ReactNode
}

export function HotspotProvider({ repoPath, refreshKey, children }: ProviderProps) {
  const [data, setData] = useState<ScoreMap>(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getHotspots({ limit: 1000 }).then(result => {
      if (cancelled) return
      if (!result.ok || result.data.length === 0) {
        setData(EMPTY)
        setLoading(false)
        return
      }
      const scores = new Map<string, number>()
      const values: number[] = []
      for (const entry of result.data) {
        scores.set(entry.path, entry.score)
        values.push(entry.score)
      }
      values.sort((a, b) => b - a) // 내림차순
      const pick = (pct: number): number => {
        if (values.length === 0) return Infinity
        const idx = Math.max(0, Math.floor(values.length * pct) - 1)
        return values[idx]
      }
      setData({
        scores,
        threshold3: pick(0.03),
        threshold10: pick(0.10),
        threshold33: pick(0.33),
      })
      setLoading(false)
    })
    return () => { cancelled = true }
    // repoPath / refreshKey 변경 시에만 재 fetch
  }, [repoPath, refreshKey])

  const value = useMemo<HotspotContextValue>(() => ({
    getLevel: (path: string): SpiceLevel => {
      const score = data.scores.get(path)
      if (score === undefined) return 0
      if (score >= data.threshold3) return 3
      if (score >= data.threshold10) return 2
      if (score >= data.threshold33) return 1
      return 0
    },
    loading,
  }), [data, loading])

  return (
    <HotspotContext.Provider value={value}>
      {children}
    </HotspotContext.Provider>
  )
}

/** 컴포넌트에서 특정 파일의 매운맛 등급 조회. Provider 밖에서는 0 반환. */
export function useSpiceLevel(path: string | null | undefined): SpiceLevel {
  const ctx = useContext(HotspotContext)
  if (!path) return 0
  return ctx.getLevel(path)
}