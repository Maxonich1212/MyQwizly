import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './lib/store'
import { applyTheme, useRoute, go } from './lib/ui'
import { uploadPending } from './lib/media'
import Icon from './components/Icon'
import { ToastHost, spring } from './components/ui'
import Auth from './screens/Auth'
import Home from './screens/Home'
import Section from './screens/Section'
import Deck from './screens/Deck'
import Study from './screens/Study'
import Stats from './screens/Stats'
import Settings from './screens/Settings'
import Import from './screens/Import'

const TABS = [
  { path: '/', icon: 'home', label: 'Главная' },
  { path: '/stats', icon: 'chart', label: 'Статистика' },
  { path: '/settings', icon: 'settings', label: 'Настройки' },
]

// Глубина экрана задаёт направление анимации перехода (вглубь — справа, назад — слева)
function depthOf(parts) {
  if (!parts.length || parts[0] === 'stats' || parts[0] === 'settings') return 0
  if (parts[0] === 's' || parts[0] === 'import') return 1
  if (parts[0] === 'd') return 2
  return 3
}

function screenFor(parts) {
  const [a, b] = parts
  if (a === 's') return <Section id={b} />
  if (a === 'd') return <Deck id={b} />
  if (a === 'study') return <Study scope={b || 'all'} />
  if (a === 'stats') return <Stats />
  if (a === 'settings') return <Settings />
  if (a === 'import') return <Import sectionId={b} />
  return <Home />
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const user = useStore((s) => s.user)
  const theme = useStore((s) => s.settings.theme)
  const { path, parts } = useRoute()
  const depth = depthOf(parts)
  const prevDepth = useRef(depth)
  const dir = depth > prevDepth.current ? 1 : depth < prevDepth.current ? -1 : 0
  useEffect(() => {
    prevDepth.current = depth
  }, [depth])

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('mq-theme', JSON.stringify(theme))
    if (theme !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [theme])

  useEffect(() => {
    if (user) uploadPending()
  }, [user])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [path])

  if (!ready) return null
  if (!user) return <Auth />

  const tabRoot = depth === 0
  const studying = parts[0] === 'study'

  return (
    <div className="app">
      {/* Только анимация входа: старый экран снимается сразу — без зависших «призраков» при быстрых переходах */}
      <motion.div
        key={path}
        initial={{ opacity: 0, x: dir * 36, scale: dir === 0 ? 0.985 : 1 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36, opacity: { duration: 0.22 } }}
      >
        {screenFor(parts)}
      </motion.div>

      <AnimatePresence>
        {tabRoot && !studying && (
          <motion.nav
            className="tabbar"
            initial={{ y: 90, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: 90, x: '-50%', opacity: 0 }}
            transition={spring}
          >
            {TABS.map((t) => {
              const on = (t.path === '/' && !parts.length) || `/${parts[0]}` === t.path
              return (
                <button key={t.path} className={on ? 'on' : ''} onClick={() => go(t.path)} aria-label={t.label}>
                  {on && <motion.span layoutId="tabpill" className="pill" transition={spring} />}
                  <Icon name={t.icon} size={21} />
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.span
                        className="label"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 'auto', opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={spring}
                      >
                        {t.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )
            })}
          </motion.nav>
        )}
      </AnimatePresence>
      <ToastHost />
    </div>
  )
}
