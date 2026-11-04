import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Footprints, Layers, Rocket, Zap, Flame, Crown, Trophy, Brain, BookMarked, Languages, Briefcase, Sunrise, Moon, Sparkles, CalendarCheck, Medal, Mountain, Star, Award, Target } from 'lucide-react'

const ICONS = { Footprints, Layers, Rocket, Zap, Flame, Crown, Trophy, Brain, BookMarked, Languages, Briefcase, Sunrise, Moon, Sparkles, CalendarCheck, Medal, Mountain, Star, Award, Target }
import { useAchievements } from '../lib/achievements'
import { useStore, updateSettings } from '../lib/store'
import { TopBar, Ring, Counter } from '../components/ui'
import { liquid } from '../components/fluid'

export function AchIcon({ name, size = 28 }) {
  const C = ICONS[name] || Award
  return <C size={size} strokeWidth={2} />
}

export default function Achievements() {
  const list = useAchievements()
  const got = list.filter((a) => a.unlocked).length
  return (
    <div className="screen">
      <TopBar title="Достижения" />
      <motion.div className="tint-card" style={{ '--c': '#f4c34a', padding: 20, marginBottom: 18 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={liquid}>
        <div className="row" style={{ gap: 18 }}>
          <Ring value={got / list.length} size={92} stroke={10} from="#f4c34a" to="#f39a4c">
            <Trophy size={30} color="#f4c34a" />
          </Ring>
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
              <Counter value={got} /> <span className="faint" style={{ fontSize: 20 }}>/ {list.length}</span>
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              открыто наград
            </div>
          </div>
        </div>
      </motion.div>
      <div className="medals">
        {[...list]
          .sort((a, b) => b.unlocked - a.unlocked || b.cur / b.target - a.cur / a.target)
          .map((a, i) => (
            <motion.div
              key={a.id}
              className={`card medal ${a.unlocked ? '' : 'locked'}`}
              initial={{ opacity: 0, scale: 0.8, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...liquid, delay: i * 0.03 }}
            >
              <div className="disc" style={a.unlocked ? { background: `radial-gradient(circle at 30% 25%, ${a.color}, color-mix(in srgb, ${a.color} 55%, #000))`, color: '#fff', boxShadow: `0 10px 24px -10px ${a.color}` } : undefined}>
                <AchIcon name={a.icon} />
                {!a.unlocked && (
                  <svg width="64" height="64" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                    <circle cx="32" cy="32" r="30" fill="none" stroke={a.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={188.5} strokeDashoffset={188.5 * (1 - a.cur / a.target)} opacity="0.85" />
                  </svg>
                )}
              </div>
              <b>{a.title}</b>
              <small>{a.unlocked ? a.desc : `${a.cur} / ${a.target}`}</small>
            </motion.div>
          ))}
      </div>
    </div>
  )
}

// Следит за новыми достижениями и показывает «каплю» сверху
export function AchievementWatcher() {
  const list = useAchievements()
  const seen = useStore((s) => s.settings.achSeen)
  const synced = useStore((s) => s.sync.at)
  const demo = useStore((s) => s.user?.id === 'demo')
  const [queue, setQueue] = useState([])
  // Ждём первую синхронизацию: иначе на новом устройстве «откроются» все старые награды разом
  const ready = !!synced || demo || !navigator.onLine

  useEffect(() => {
    if (!ready) return
    const ids = list.filter((a) => a.unlocked).map((a) => a.id)
    if (!seen) {
      updateSettings({ achSeen: ids })
      return
    }
    const fresh = ids.filter((id) => !seen.includes(id))
    if (!fresh.length) return
    updateSettings({ achSeen: [...seen, ...fresh] })
    setQueue((q) => [...q, ...list.filter((a) => fresh.includes(a.id))])
  }, [list, seen, ready])

  const cur = queue[0]
  useEffect(() => {
    if (!cur) return
    navigator.vibrate?.([15, 50, 25])
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 3400)
    return () => clearTimeout(t)
  }, [cur])

  return (
    <AnimatePresence>
      {cur && (
        <motion.div
          key={cur.id}
          className="ach-toast"
          initial={{ y: -90, x: '-50%', scale: 0.6, opacity: 0 }}
          animate={{ y: 0, x: '-50%', scale: 1, opacity: 1 }}
          exit={{ y: -70, x: '-50%', scale: 0.8, opacity: 0 }}
          transition={liquid}
          onClick={() => setQueue((q) => q.slice(1))}
        >
          <motion.div
            style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', background: cur.color, flexShrink: 0 }}
            initial={{ rotate: -40, scale: 0.4 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 10, delay: 0.15 }}
          >
            <AchIcon name={cur.icon} size={22} />
          </motion.div>
          <div>
            <div className="mono-label" style={{ fontSize: 10 }}>
              Новое достижение
            </div>
            <div style={{ fontWeight: 750 }}>{cur.title}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
