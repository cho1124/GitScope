import type { ReactNode } from 'react'
import type { GraphRow } from '../lib/graph'

interface Props {
  row: GraphRow
  commitHash: string
  laneCount: number
  laneWidth?: number
  lineHeight?: number
}

/**
 * 커밋 한 줄의 그래프 컬럼을 SVG로 렌더.
 * 상단(y=0)과 하단(y=lineHeight)이 위/아래 row와 자연스럽게 이어지도록,
 * 각 row 내부에서만 자기 세로선/연결선을 그림.
 */
export function CommitGraph({
  row,
  commitHash,
  laneCount,
  laneWidth = 14,
  lineHeight = 28,
}: Props) {
  const width = Math.max(1, laneCount) * laneWidth
  const cx = row.lane * laneWidth + laneWidth / 2
  const cy = lineHeight / 2
  const elements: ReactNode[] = []

  // 1. 지나가는 세로선 (before[i] === after[i] 이고 내 lane 아님)
  for (let i = 0; i < laneCount; i++) {
    if (i === row.lane) continue
    const before = row.beforeLanes[i] ?? null
    const after = row.afterLanes[i] ?? null
    if (before && before === after) {
      const x = i * laneWidth + laneWidth / 2
      elements.push(
        <line
          key={`pass-${i}`}
          x1={x}
          y1={0}
          x2={x}
          y2={lineHeight}
          stroke={row.laneColors[i]}
          strokeWidth={1.5}
        />
      )
    }
  }

  // 2. 수렴 곡선 (before[i] === 이 커밋, i ≠ row.lane)
  for (let i = 0; i < row.beforeLanes.length; i++) {
    if (i === row.lane) continue
    if (row.beforeLanes[i] === commitHash) {
      const x = i * laneWidth + laneWidth / 2
      elements.push(
        <path
          key={`conv-${i}`}
          d={`M${x},0 Q${x},${cy} ${cx},${cy}`}
          stroke={row.laneColors[i]}
          strokeWidth={1.5}
          fill="none"
        />
      )
    }
  }

  // 3. 내 lane incoming (위 세로선)
  if (row.beforeLanes[row.lane] === commitHash) {
    elements.push(
      <line
        key="in-me"
        x1={cx}
        y1={0}
        x2={cx}
        y2={cy}
        stroke={row.color}
        strokeWidth={1.5}
      />
    )
  }

  // 4. 내 lane outgoing (아래 세로선)
  if (row.afterLanes[row.lane]) {
    elements.push(
      <line
        key="out-me"
        x1={cx}
        y1={cy}
        x2={cx}
        y2={lineHeight}
        stroke={row.color}
        strokeWidth={1.5}
      />
    )
  }

  // 5. 분기 곡선 (parentLanes 중 내 lane이 아닌 것)
  for (const pLane of row.parentLanes) {
    if (pLane === row.lane) continue
    const x = pLane * laneWidth + laneWidth / 2
    elements.push(
      <path
        key={`branch-${pLane}`}
        d={`M${cx},${cy} Q${x},${cy} ${x},${lineHeight}`}
        stroke={row.laneColors[pLane]}
        strokeWidth={1.5}
        fill="none"
      />
    )
  }

  // 6. Commit circle
  elements.push(
    <circle
      key="dot"
      cx={cx}
      cy={cy}
      r={4.5}
      fill={row.color}
      stroke="var(--bg-primary)"
      strokeWidth={2}
    />
  )

  return (
    <svg
      width={width}
      height={lineHeight}
      style={{ flexShrink: 0, display: 'block' }}
      aria-hidden="true"
    >
      {elements}
    </svg>
  )
}