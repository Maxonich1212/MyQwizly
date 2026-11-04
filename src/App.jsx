import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarCheck, Layers, ChartNoAxesColumn, Settings as SettingsIcon } from 'lucide-react'
import { useStore } from './lib/store'
import { applyTheme, useRoute, go } from './lib/ui'
import { uploadPending } from './lib/media'
import { ToastHost } from './components/ui'
import { liquid } from './components/fluid'
import Auth from './screens/Auth'
import Habits from './screens/Habits'
import HabitDetail from './screens/HabitDetail'
import Home from './screens/Home'
import Section from './screens/Section'
import Deck from './screens/Deck'
import Study from './screens/Study'
import Stats from './screens/Stats'
import Settings from './screens/Settings'
import Import from './screens/Import'
import Achievements, { AchievementWatcher } from './screens/Achievements'
import Trash from './screens/Trash'
import SyncAsk from './components/SyncAsk'
import NewPassword from './components/NewPassword'
import { ErrorBoundary, UpdateBanner } from './components/Safety'

// Привычки — главный экран (нужны каждый день), карточки — вторая вкладка
const TABS = [
  { path: '/', icon: CalendarCheck, label: 'Привычки' },
  { path: '/cards', icon: Layers, label: 'Карточки' },
  { path: '/stats', icon: ChartNoAxesColumn, label: 'Статистика' },
  { path: '/settings', icon: SettingsIcon, label: 'Настройки' },
]
const ROOTS = ['', 'cards', 'stats', 'settings']

// Глубина экрана задаёт направление перехода (вглубь — справа, назад — слева)
function depthOf(parts) {
  const a = parts[0] || ''
  if (ROOTS.includes(a)) return 0
  if (['s', 'import', 'h', 'achievements', 'trash'].includes(a)) return 1
  if (a === 'd') return 2
  return 3
}

function screenFor(parts) {
  const [a, b] = parts
  if (a === 'cards') return <Home />
  if (a === 'h') return <HabitDetail id={b} />
  if (a === 's') return <Section id={b} />
  if (a === 'd') return <Deck id={b} />
  if (a === 'study') return <Study scope={b || 'all'} />
  if (a === 'stats') return <Stats />
  if (a === 'settings') return <Settings />
  if (a === 'import') return <Import sectionId={b} />
  if (a === 'achievements') return <Achievements />
  if (a === 'trash') return <Trash />
  return <Habits />
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const user = useStore((s) => s.user)
  const theme = useStore((s) => s.settings.theme)
  const { path, parts } = useRoute()
  const depth = depthOf(parts)
  const prev = useRef({ path, depth })
  // Направление считаем только при смене экрана, а не при каждом рендере
  if (prev.current.path !== path) prev.current = { path, depth, dir: Math.sign(depth - prev.current.depth) }
  const dir = prev.current.dir || 0

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
  if (!user)
    return (
      <>
        <Auth />
        <UpdateBanner />
      </>
    )

  const tabRoot = depth === 0
  const active = `/${parts[0] || ''}`

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      {/* Только анимация входа: новый экран «проявляется» из размытия, старый снимается сразу.
          filter создаёт контейнер для position:fixed — после анимации снимаем его (transitionEnd) */}
      <motion.div
        key={path}
        initial={{ opacity: 0, x: dir * 34, y: dir === 0 ? 10 : 0, scale: dir === 0 ? 0.985 : 1, filter: 'blur(8px)' }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
        transition={{ ...liquid, opacity: { duration: 0.25 }, filter: { duration: 0.3 } }}
      >
        <ErrorBoundary key={path}>{screenFor(parts)}</ErrorBoundary>
      </motion.div>

      <AnimatePresence>
        {tabRoot && (
          <motion.nav
            className="tabbar"
            initial={{ y: 90, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: 90, x: '-50%', opacity: 0 }}
            transition={liquid}
          >
            {TABS.map((t) => {
              const on = active === t.path
              return (
                <button key={t.path} className={on ? 'on' : ''} onClick={() => go(t.path)} aria-label={t.label}>
                  {on && <motion.span layoutId="tabpill" className="pill" transition={liquid} />}
                  <t.icon size={21} strokeWidth={on ? 2.3 : 2} />
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.span className="label" initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={liquid}>
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
      <AchievementWatcher />
      <SyncAsk />
      <NewPassword />
      <UpdateBanner />
    </div>
  )
}
