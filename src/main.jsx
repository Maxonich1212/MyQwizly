import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { boot } from './lib/store'
import { applyTheme } from './lib/ui'
import { registerServiceWorker, requestPersistentStorage } from './components/Safety'

// Тема до первого рендера, чтобы не мигало
try {
  applyTheme(JSON.parse(localStorage.getItem('mq-theme') || '"system"'))
} catch {
  applyTheme('system')
}

window.__bootSet?.(45)
// ?slowboot — только в разработке: задержка, чтобы рассмотреть заставку
const slow = import.meta.env.DEV && new URLSearchParams(location.search).has('slowboot')
;(slow ? new Promise((r) => setTimeout(r, 3000)) : Promise.resolve()).then(() => boot().then(() => window.__bootSet?.(85)))
requestPersistentStorage()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD) registerServiceWorker(`${import.meta.env.BASE_URL}sw.js`)
