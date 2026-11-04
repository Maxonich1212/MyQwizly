import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { boot } from './lib/store'
import { applyTheme } from './lib/ui'

// Тема до первого рендера, чтобы не мигало
try {
  applyTheme(JSON.parse(localStorage.getItem('mq-theme') || '"system"'))
} catch {
  applyTheme('system')
}

boot()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
}
