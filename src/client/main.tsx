import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmModal'
import './global.css'

// 초기 테마 적용 — React 렌더 전에 실행해서 flash 방지
const savedTheme = localStorage.getItem('gitscope.theme')
if (savedTheme === 'mocha' || savedTheme === 'latte' || savedTheme === 'frappe' || savedTheme === 'macchiato') {
  document.documentElement.setAttribute('data-theme', savedTheme)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </ToastProvider>
  </React.StrictMode>
)