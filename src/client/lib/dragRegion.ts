import { getCurrentWindow } from '@tauri-apps/api/window'

const win = getCurrentWindow()

/**
 * Tauri 2 의 data-tauri-drag-region 자동 핸들러는 decorations:false 윈도우에서
 * 가끔 동작하지 않는 케이스가 있어 명시적 mousedown 핸들러를 사용한다.
 *
 * - 단일 클릭 + 좌클릭 → startDragging() (창 이동)
 * - 더블 클릭 → toggleMaximize() (최대화/복원)
 * - target / closest 가 button/input/select/textarea/data-tauri-drag-region="false"
 *   이면 무시 (드래그 안 함)
 */
export function onDragHandle(e: React.MouseEvent): void {
  if (e.buttons !== 1) return
  const target = e.target as HTMLElement | null
  if (!target) return
  // 인터랙티브 요소 안에서 일어난 mousedown 이면 드래그 무시
  if (target.closest('button, input, select, textarea, a, [role="menuitem"], [data-tauri-drag-region="false"]')) {
    return
  }
  if (e.detail === 2) {
    win.toggleMaximize().catch(() => {})
    return
  }
  win.startDragging().catch(() => {})
}
