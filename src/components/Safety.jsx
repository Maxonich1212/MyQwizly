import { Component, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { liquid } from './fluid'

// Страховка от белого экрана: если экран упал, показываем заглушку, данные при этом не трогаются
export class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('Экран упал', error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="card pad" style={{ textAlign: 'center', maxWidth: 420 }}>
          <TriangleAlert size={40} style={{ color: 'var(--hard)', marginBottom: 8 }} />
          <h3 style={{ margin: '0 0 6px' }}>Что-то пошло не так</h3>
          <p className="muted small" style={{ margin: '0 0 6px' }}>
            Твои данные в безопасности — они сохранены на устройстве и в облаке.
          </p>
          <p className="faint small" style={{ margin: '0 0 18px', fontFamily: 'var(--mono)', overflowWrap: 'anywhere' }}>
            {String(this.state.error?.message || this.state.error).slice(0, 160)}
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => location.reload()}>
              Перезагрузить
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                location.hash = '/'
                this.setState({ error: null })
              }}
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    )
  }
}

// ——— Обновления: новый service worker ждёт, пока пользователь нажмёт «Обновить» ———

let waitingWorker = null
const listeners = new Set()
const notify = () => listeners.forEach((l) => l(!!waitingWorker))

export function registerServiceWorker(url) {
  if (!('serviceWorker' in navigator)) return
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    location.reload()
  })
  navigator.serviceWorker.register(url).then((reg) => {
    const track = (w) => {
      if (!w) return
      w.addEventListener('statechange', () => {
        // installed + уже есть активный контроллер = это обновление, а не первая установка
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = w
          notify()
        }
      })
    }
    if (reg.waiting && navigator.serviceWorker.controller) {
      waitingWorker = reg.waiting
      notify()
    }
    reg.addEventListener('updatefound', () => track(reg.installing))
    // Проверяем обновления при каждом возвращении в приложение
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}))
    setInterval(() => reg.update().catch(() => {}), 30 * 60e3)
  })
}

export function UpdateBanner() {
  const [ready, setReady] = useState(!!waitingWorker)
  useEffect(() => {
    listeners.add(setReady)
    return () => listeners.delete(setReady)
  }, [])
  return (
    <AnimatePresence>
      {ready && (
        <motion.button
          className="ach-toast"
          style={{ cursor: 'pointer' }}
          initial={{ y: -90, x: '-50%', scale: 0.7, opacity: 0 }}
          animate={{ y: 0, x: '-50%', scale: 1, opacity: 1 }}
          exit={{ y: -80, x: '-50%', opacity: 0 }}
          transition={liquid}
          onClick={() => waitingWorker?.postMessage('skip-waiting')}
        >
          <span style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--accent)', color: '#fff', flexShrink: 0 }}>
            <RefreshCw size={19} />
          </span>
          <span style={{ textAlign: 'left' }}>
            <span className="mono-label" style={{ fontSize: 10, display: 'block' }}>
              Новая версия
            </span>
            <b>Обновить приложение</b>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

// Просим браузер не чистить IndexedDB при нехватке места
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* не поддерживается — не страшно, данные всё равно в облаке */
  }
}
