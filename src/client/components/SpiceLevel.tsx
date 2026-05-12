import { useSpiceLevel } from '../lib/hotspotContext'
import { useShowSpiceLevels } from '../lib/displaySettings'

interface Props {
  path: string
}

/**
 * 핫 페퍼 배지 — 파일의 매운맛 등급(🌶️ 1~3개).
 *
 * - Forensics 핫스팟 score 의 상위 33% / 10% / 3% percentile 분류
 * - 설정창 토글 off 또는 등급 0이면 null
 * - 인라인 소형: 12px 글자 / muted 톤 / margin-left 6px
 */
export function SpiceLevel({ path }: Props) {
  const enabled = useShowSpiceLevels()
  const level = useSpiceLevel(path)
  if (!enabled || level === 0) return null

  const peppers = '🌶️'.repeat(level)
  const titles: Record<number, string> = {
    1: '핫스팟 (상위 33%) — 가끔 변경됨',
    2: '핫스팟 (상위 10%) — 자주 변경됨',
    3: '핫스팟 (상위 3%) — 매우 자주 변경 / 리팩토링 후보',
  }

  return (
    <span
      aria-label={titles[level]}
      title={titles[level]}
      style={{
        marginLeft: 6,
        fontSize: 10,
        lineHeight: 1,
        verticalAlign: 'middle',
        userSelect: 'none',
        opacity: 0.85,
        flexShrink: 0,
      }}
    >
      {peppers}
    </span>
  )
}