import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmModal'
import { applyTheme, getSavedTheme } from './components/ThemeSelector'
import { initDisplaySettings } from './lib/displaySettings'
import './global.css'

// 리브랜딩 마이그레이션 — 과거 'gitscope.*' localStorage 키를 'pepper.*' 로 한 번만 옮김.
// 사용자 설정(테마/사이드바 너비/날짜 포맷 등)이 reset 되지 않도록.
function migrateLegacyKeys() {
  try {
    const OLD = 'gitscope.'
    const NEW = 'pepper.'
    const toMove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(OLD)) toMove.push(k)
    }
    for (const oldKey of toMove) {
      const newKey = NEW + oldKey.slice(OLD.length)
      const value = localStorage.getItem(oldKey)
      if (value !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value)
      }
      localStorage.removeItem(oldKey)
    }
  } catch { /* private mode 등 — 무시 */ }
}
migrateLegacyKeys()

// 초기 테마 적용 — React 렌더 전에 실행해서 flash 방지 (built-in + custom 모두 처리)
applyTheme(getSavedTheme())
// 표시 옵션 (row padding) CSS 변수 초기 동기화
initDisplaySettings()

// WebView2 기본 컨텍스트 메뉴 차단 (Tauri dev 모드에서 React preventDefault 만으로는 안 됨).
// 입력 요소(텍스트 복사/붙여넣기)에서는 허용.
document.addEventListener('contextmenu', (e) => {
  const target = e.target as HTMLElement | null
  if (!target) return
  if (target.matches?.('input, textarea, [contenteditable="true"], [contenteditable=""]')) return
  e.preventDefault()
}, { capture: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </ToastProvider>
  </React.StrictMode>
)