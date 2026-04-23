import type { CommitInfo } from '../api'

/**
 * 커밋 그래프 레인 정보. 각 커밋 row 하나당 하나.
 *
 * - `beforeLanes`: 이 커밋 처리 직전의 lane 상태 (각 슬롯이 기다리는 다음 커밋 hash)
 * - `afterLanes`: 이 커밋 처리 직후의 lane 상태
 * - `laneColors`: 각 lane 인덱스의 색 (palette 순환)
 * - `parentLanes`: 이 커밋의 parent들이 배치된 lane 인덱스 (분기 그릴 때 사용)
 */
export interface GraphRow {
  lane: number
  color: string
  beforeLanes: (string | null)[]
  afterLanes: (string | null)[]
  laneColors: string[]
  parentLanes: number[]
}

const PALETTE = [
  'var(--accent)',
  'var(--green)',
  'var(--peach)',
  'var(--yellow)',
  'var(--mauve)',
  'var(--red)',
  'var(--accent-hover)',
]

/**
 * 커밋 리스트(최신 → 오래된 순)를 받아서 각 커밋에 lane 정보를 할당.
 *
 * 알고리즘 요약:
 *   - `lanes[i]`는 "i번째 레인이 다음에 받을 커밋 hash" (null = 빈 슬롯)
 *   - 각 커밋마다:
 *     1) 이 hash를 기다리는 lane 있으면 거기 배치 / 없으면 빈 슬롯 / 그것도 없으면 새 lane
 *     2) 다른 lane도 같은 hash 기다리면 → 이 커밋으로 수렴 (merge 수렴)
 *     3) parents 배치: 첫 parent는 내 lane 유지, 추가 parent는 빈 슬롯 or 새 lane
 *     4) trailing null slot은 trim (레인 재사용)
 */
export function buildGraph(commits: CommitInfo[]): GraphRow[] {
  const rows: GraphRow[] = []
  const lanes: (string | null)[] = []
  const laneColorMap = new Map<number, string>()
  let colorCursor = 0

  const pickColor = (lane: number): string => {
    let c = laneColorMap.get(lane)
    if (!c) {
      c = PALETTE[colorCursor % PALETTE.length]
      colorCursor++
      laneColorMap.set(lane, c)
    }
    return c
  }

  for (const c of commits) {
    const beforeLanes = [...lanes]

    // 1. 이 커밋의 lane 결정
    let myLane = lanes.indexOf(c.hash)
    if (myLane === -1) {
      myLane = lanes.indexOf(null)
      if (myLane === -1) {
        myLane = lanes.length
        lanes.push(null)
      }
    }
    const myColor = pickColor(myLane)

    // 2. 같은 hash 기다리던 다른 lane들은 이 커밋으로 수렴 → 비움
    for (let i = 0; i < lanes.length; i++) {
      if (i !== myLane && lanes[i] === c.hash) {
        lanes[i] = null
        laneColorMap.delete(i)
      }
    }

    // 3. parents 배치
    const parentLanes: number[] = []
    if (c.parents.length === 0) {
      // 초기 커밋: 내 lane 비움
      lanes[myLane] = null
      laneColorMap.delete(myLane)
    } else {
      // 첫 parent는 내 lane 유지
      lanes[myLane] = c.parents[0]
      parentLanes.push(myLane)
      for (let i = 1; i < c.parents.length; i++) {
        const p = c.parents[i]
        let pLane = lanes.indexOf(p)
        if (pLane === -1) {
          pLane = lanes.indexOf(null)
          if (pLane === -1) {
            pLane = lanes.length
            lanes.push(p)
          } else {
            lanes[pLane] = p
          }
        }
        parentLanes.push(pLane)
      }
    }

    const afterLanes = [...lanes]

    const maxLen = Math.max(beforeLanes.length, afterLanes.length, myLane + 1)
    const laneColors: string[] = []
    for (let i = 0; i < maxLen; i++) {
      laneColors.push(pickColor(i))
    }

    rows.push({
      lane: myLane,
      color: myColor,
      beforeLanes,
      afterLanes,
      laneColors,
      parentLanes,
    })

    // trailing null slots trim (레인 슬롯 재사용)
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop()
    }
  }

  return rows
}

export function maxLaneCount(rows: GraphRow[]): number {
  let max = 0
  for (const r of rows) {
    const n = Math.max(r.beforeLanes.length, r.afterLanes.length, r.lane + 1)
    if (n > max) max = n
  }
  return max
}