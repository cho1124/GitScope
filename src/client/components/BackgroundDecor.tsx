import { useMemo } from 'react'
import {
  GitBranch, GitCommit, GitMerge, GitPullRequest, GitFork, Tag, Cherry, Code2,
  Code, Braces, Terminal, FileCode, Cpu, Binary, Hash, Bug,
  Circle, Square, Triangle, Diamond, Hexagon, Star,
  Cat, Dog, Bird, Fish, Rabbit, Squirrel, Turtle, PawPrint,
  Sun, Moon, Cloud, Flame, Sparkles, Heart, Coffee, Leaf,
  type LucideIcon,
} from 'lucide-react'
import {
  useDecorConfig, resolveColorVar, speedToDurationSec,
  type DecorConfig, type IconSet,
} from '../lib/decorSettings'

/** 이름(PascalCase) → 컴포넌트 매핑. iconSet='custom' 일 때 사용. */
const ICON_REGISTRY: Record<string, LucideIcon> = {
  GitBranch, GitCommit, GitMerge, GitPullRequest, GitFork, Tag, Cherry, Code2,
  Code, Braces, Terminal, FileCode, Cpu, Binary, Hash, Bug,
  Circle, Square, Triangle, Diamond, Hexagon, Star,
  Cat, Dog, Bird, Fish, Rabbit, Squirrel, Turtle, PawPrint,
  Sun, Moon, Cloud, Flame, Sparkles, Heart, Coffee, Leaf,
}

const ICON_SETS: Record<IconSet, LucideIcon[]> = {
  git: [GitBranch, GitCommit, GitMerge, GitPullRequest, GitFork, Tag, Cherry, Code2],
  code: [Code, Braces, Terminal, FileCode, Cpu, Binary, Hash, Bug],
  minimal: [Circle, Square, Triangle, Diamond, Hexagon, Star],
  fun: [Cat, Dog, Bird, Fish, Rabbit, Squirrel, Turtle, PawPrint, Sun, Moon, Heart, Coffee, Sparkles, Leaf, Cloud, Flame],
  custom: [], // 동적으로 결정 (config.customIcons → ICON_REGISTRY)
  none: [],
}

/** customIcons 배열을 ICON_REGISTRY 로 매핑. 알 수 없는 이름은 건너뜀. */
function resolveCustomIcons(names: string[]): LucideIcon[] {
  const out: LucideIcon[] = []
  for (const n of names) {
    const icon = ICON_REGISTRY[n]
    if (icon) out.push(icon)
  }
  return out
}

export const AVAILABLE_ICON_NAMES = Object.keys(ICON_REGISTRY).sort()

interface Particle {
  id: number
  iconIndex: number
  /** % 위치 — 시작 지점 */
  left: number
  top: number
  /** 초 단위 애니메이션 길이 */
  duration: number
  /** 초 단위 시작 지연 (음수 → 이미 진행 중인 듯) */
  delay: number
  /** 회전 시작 각도 0~360 */
  rotateBase: number
  /** 0.6 ~ 1.0 — 같은 config.size 내에서 약간씩 다양 */
  scale: number
}

function pseudoRandom(seed: number): () => number {
  // 시드 기반 난수 — config 같으면 같은 분포 (HMR 재마운트 시 깜빡임 방지)
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function resolveIcons(config: DecorConfig): LucideIcon[] {
  if (config.iconSet === 'custom') return resolveCustomIcons(config.customIcons)
  return ICON_SETS[config.iconSet]
}

function generateParticles(config: DecorConfig): Particle[] {
  if (!config.enabled || config.iconSet === 'none') return []
  const iconCount = resolveIcons(config).length
  if (iconCount === 0) return []
  const rnd = pseudoRandom(config.density * 1000 + config.iconSet.length + config.size)
  const [durMin, durMax] = speedToDurationSec(config.speed)
  const particles: Particle[] = []
  for (let i = 0; i < config.density; i++) {
    const duration = durMin + rnd() * (durMax - durMin)
    particles.push({
      id: i,
      iconIndex: Math.floor(rnd() * iconCount),
      left: rnd() * 100,
      top: rnd() * 100,
      duration,
      // -duration ~ 0 사이 delay → 첫 렌더 시 이미 곳곳에 분포한 듯 보이게
      delay: -rnd() * duration,
      rotateBase: rnd() * 360,
      scale: 0.6 + rnd() * 0.4,
    })
  }
  return particles
}

export function BackgroundDecor() {
  const config = useDecorConfig()
  const particles = useMemo(() => generateParticles(config), [config])

  if (!config.enabled || particles.length === 0) return null

  const iconArr = resolveIcons(config)
  if (iconArr.length === 0) return null
  const color = resolveColorVar(config.color)

  const animName =
    config.drift === 'up' ? 'decor-drift-up'
    : config.drift === 'down' ? 'decor-drift-down'
    : 'decor-drift-all'

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {particles.map(p => {
        const Icon = iconArr[p.iconIndex]
        const size = Math.round(config.size * p.scale)
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${p.left}%`,
          top: `${p.top}%`,
          color,
          opacity: config.opacity,
          animation: `${animName} ${p.duration}s linear infinite`,
          animationDelay: `${p.delay}s`,
          // 시작 각도 차이를 위해 CSS var 활용
          ['--decor-rotate-base' as 'transform']: `${p.rotateBase}deg` as unknown as string,
          willChange: 'transform',
        }
        return (
          <span key={p.id} style={style}>
            <Icon size={size} strokeWidth={1.5} />
          </span>
        )
      })}
    </div>
  )
}