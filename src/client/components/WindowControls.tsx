import { useEffect, useState } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'

const win = getCurrentWindow()

/**
 * 커스텀 타이틀 바의 최소화 / 최대화 / 닫기 컨트롤.
 * Tauri 2 의 `decorations: false` 설정과 함께 사용한다.
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let unlisten: (() => void) | null = null
    win.isMaximized().then(setMaximized)
    win.onResized(() => {
      win.isMaximized().then(setMaximized)
    }).then(fn => { unlisten = fn })
    return () => { if (unlisten) unlisten() }
  }, [])

  return (
    <div
      className="window-controls"
      data-tauri-drag-region="false"
      style={{ display: 'inline-flex' }}
    >
      <ControlButton
        ariaLabel="최소화"
        onClick={() => win.minimize()}
        icon={<Minus size={13} strokeWidth={2} />}
      />
      <ControlButton
        ariaLabel={maximized ? '복원' : '최대화'}
        onClick={() => win.toggleMaximize()}
        icon={
          maximized
            ? <Copy size={11} strokeWidth={1.8} style={{ transform: 'scaleX(-1)' }} />
            : <Square size={11} strokeWidth={1.8} />
        }
      />
      <ControlButton
        ariaLabel="닫기"
        onClick={() => win.close()}
        icon={<X size={13} strokeWidth={2} />}
        danger
      />
    </div>
  )
}

function ControlButton({
  ariaLabel, onClick, icon, danger,
}: {
  ariaLabel: string
  onClick: () => void
  icon: React.ReactNode
  danger?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-tauri-drag-region="false"
      style={{
        width: 46,
        background: hover
          ? (danger ? 'var(--red)' : 'var(--bg-hover)')
          : 'transparent',
        color: hover && danger ? 'var(--bg-primary)' : 'var(--text-secondary)',
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.1s ease-out, color 0.1s ease-out',
        outline: 'none',
        padding: 0,
      }}
    >
      {icon}
    </button>
  )
}
