import { useEffect, useRef, useState } from 'react'
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
import { DialogHost } from './components/Dialog'
import Splash from './components/Splash'

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
  const today = useStore((s) => s.today)
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

  const hideBar = useHideOnScroll(path)

  // Загрузочный экран держим минимум ~0.9 с, чтобы он не мелькал, и плавно растворяем
  const [showSplash, setShowSplash] = useState(true)
  const bootAt = useRef(performance.now())
  useEffect(() => {
    if (!ready) return
    // Добиваем полосу до 100% и даём увидеть заполнение, потом растворяем заставку
    clearInterval(window.__bootTimer)
    window.__bootSet?.(100)
    const t = setTimeout(() => setShowSplash(false), Math.max(550, 1100 - (performance.now() - bootAt.current)))
    return () => clearTimeout(t)
  }, [ready])

  const content = !ready ? null : !user ? (
      <>
        <div className="ambient" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <Auth />
        <UpdateBanner />
        <NewPassword />
        <DialogHost />
      </>
    ) : null

  const tabRoot = depth === 0
  const barHidden = hideBar && tabRoot
  const active = `/${parts[0] || ''}`

  if (content || !ready)
    return (
      <>
        {content}
        <AnimatePresence>{showSplash && <Splash key="splash" />}</AnimatePresence>
      </>
    )

  return (
    <div className="app">
      <AnimatePresence>{showSplash && <Splash key="splash" />}</AnimatePresence>
      <div className="top-fade" aria-hidden="true" />
      <div className="ambient" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      {/* Только анимация входа: новый экран «проявляется» из размытия, старый снимается сразу.
          Анимируем только transform и opacity — их считает видеокарта, переходы не лагают */}
      <motion.div
        key={path + today}
        initial={{ opacity: 0, x: dir * 28, y: dir === 0 ? 8 : 0 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 40, opacity: { duration: 0.18, ease: 'easeOut' } }}
      >
        <ErrorBoundary key={path + today}>{screenFor(parts)}</ErrorBoundary>
      </motion.div>

      <AnimatePresence>
        {tabRoot && (
          <motion.nav
            className="tabbar"
            initial={{ y: 90, x: '-50%', opacity: 0 }}
            animate={{ y: barHidden ? 110 : 0, x: '-50%', opacity: barHidden ? 0 : 1 }}
            exit={{ y: 90, x: '-50%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <TabBar active={active} />
          </motion.nav>
        )}
      </AnimatePresence>
      <ToastHost />
      <AchievementWatcher />
      <SyncAsk />
      <NewPassword />
      <UpdateBanner />
      <DialogHost />
    </div>
  )
}

// Таб-бар как в iOS: вкладки одинаковой ширины, подсветка перетекает между ними каплей.
// Позиция считается от индекса, а не от размеров элементов, — поэтому никаких «выездов» сбоку
function TabBar({ active }) {
  const idx = Math.max(0, TABS.findIndex((t) => t.path === active))
  const prev = useRef(idx)
  const jump = Math.abs(idx - prev.current)
  useEffect(() => {
    prev.current = idx
  }, [idx])
  return (
    <div className="tabs" style={{ '--n': TABS.length }}>
      <motion.span
        className="tab-pill"
        initial={false}
        animate={{ x: `${idx * 100}%`, scaleX: jump ? [1, 1 + 0.12 * jump, 1] : 1, scaleY: jump ? [1, 0.9, 1] : 1 }}
        transition={{ x: { type: 'spring', stiffness: 420, damping: 34 }, scaleX: { duration: 0.42, ease: 'easeOut' }, scaleY: { duration: 0.42, ease: 'easeOut' } }}
      />
      {TABS.map((t) => {
        const on = active === t.path
        return (
          <motion.button key={t.path} className={on ? 'on' : ''} onClick={() => !on && go(t.path)} aria-label={t.label} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
            <t.icon size={21} strokeWidth={on ? 2.3 : 1.9} />
            <span className="label">{t.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

// Прячем таб-бар при прокрутке вниз (чтобы не мешал смотреть), показываем при прокрутке вверх и у самого верха
function useHideOnScroll(resetKey) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    setHidden(false)
    let last = window.scrollY
    let acc = 0
    const on = () => {
      const y = window.scrollY
      const d = y - last
      last = y
      if (y < 30) {
        acc = 0
        return setHidden(false)
      }
      // Копим смещение в одну сторону, чтобы не дёргался от дрожания пальца
      acc = Math.sign(d) === Math.sign(acc) ? acc + d : d
      if (acc > 6) setHidden(true)
      else if (acc < -10) setHidden(false)
    }
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [resetKey])
  return hidden
}
