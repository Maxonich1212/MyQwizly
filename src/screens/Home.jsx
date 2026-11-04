import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Play, Trophy } from 'lucide-react'
import { useStore } from '../lib/store'
import { useDays, useStreak, useToday, useSectionStreaks, useQueueState } from '../lib/hooks'
import { buildQueue } from '../lib/queue'
import { go } from '../lib/ui'
import { color } from '../lib/palette'
import { goalFor } from '../lib/stats'
import { dayKey, fmtDay, plural, addDays } from '../lib/day'
import { noteStatus } from '../lib/srs'
import { Ring, Flame, Counter } from '../components/ui'
import { DotGrid, liquid } from '../components/fluid'
import { SectionEditor } from '../components/Editors'
import { CreateSheet } from '../components/Create'

// Сколько секунд в среднем уходит на карточку — по последним ответам
export function useSecondsPerCard() {
  const reviews = useStore((s) => s.reviews)
  return useMemo(() => {
    const recent = Object.values(reviews)
      .sort((a, b) => b.reviewed_at - a.reviewed_at)
      .slice(0, 200)
      .map((r) => Math.min(r.ms, 90000))
    if (recent.length < 10) return 15
    return Math.max(5, recent.reduce((a, b) => a + b, 0) / recent.length / 1000)
  }, [reviews])
}

const mins = (cards, spc) => Math.max(1, Math.round((cards * spc) / 60))

export default function Home() {
  const sections = useStore((s) => s.sections)
  const settings = useStore((s) => s.settings)
  const st = useQueueState()
  const streak = useStreak()
  const today = useToday()
  const spc = useSecondsPerCard()
  const [newSection, setNewSection] = useState(false)
  const [create, setCreate] = useState(false)
  const goal = goalFor(settings, dayKey())
  const live = useMemo(() => Object.values(sections).filter((s) => !s.deleted).sort((a, b) => a.sort - b.sort), [sections])

  // План: по каждому разделу — сколько к повторению и сколько новых
  const plan = useMemo(() => {
    const rows = live.map((s) => {
      const { counts } = buildQueue({ ...st, scope: { sectionId: s.id } })
      return { s, due: counts.due, fresh: counts.fresh, total: counts.due + counts.fresh }
    })
    return { rows: rows.filter((r) => r.total), total: rows.reduce((a, r) => a + r.total, 0) }
  }, [live, st])

  return (
    <div className="screen">
      <motion.div className="head" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={liquid}>
        <div className="grow">
          <div className="mono-label">Quizly · {fmtDay(dayKey())}</div>
          <h1 className="title" style={{ margin: '4px 0 0' }}>
            Карточки
          </h1>
        </div>
        <motion.button className="round" whileTap={{ scale: 0.88 }} onClick={() => go('/achievements')} aria-label="Достижения">
          <Trophy size={20} />
        </motion.button>
        <motion.button className="round accent" whileTap={{ scale: 0.88 }} onClick={() => setCreate(true)} aria-label="Создать">
          <Plus size={22} strokeWidth={2.4} />
        </motion.button>
      </motion.div>

      {/* Итог дня: цель + одна понятная главная кнопка */}
      <motion.div className="tint-card" style={{ '--c': '#7c7eff', padding: 20 }} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={liquid}>
        <div className="hero-grid">
          <Ring value={today.n / goal} size={116} stroke={11}>
            <div>
              <b>
                <Counter value={today.n} />
              </b>
              <small>из {goal}</small>
            </div>
          </Ring>
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 6, marginBottom: 2 }}>
              <Flame size={18} active={streak.current > 0} animated={streak.todayDone} />
              <span style={{ fontWeight: 700 }}>
                {streak.current} {plural(streak.current, 'день', 'дня', 'дней')}
              </span>
              <span className="faint small">{streak.todayDone ? '· цель выполнена' : ''}</span>
            </div>
            {plan.total > 0 ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 760, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                  {plan.total} {plural(plan.total, 'карточка', 'карточки', 'карточек')}
                </div>
                <div className="small muted">
                  ≈ {mins(plan.total, spc)} мин · {plan.rows.length} {plural(plan.rows.length, 'раздел', 'раздела', 'разделов')}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 20, fontWeight: 740, lineHeight: 1.2 }}>{live.length ? 'Всё повторено' : 'Пока пусто'}</div>
                <div className="small muted">{live.length ? 'Новые повторения появятся завтра' : 'Создай раздел или импортируй колоду'}</div>
              </>
            )}
          </div>
        </div>
        {plan.total > 0 && (
          <motion.button className="btn primary block" style={{ marginTop: 18, flexDirection: 'column', height: 58, gap: 0 }} whileTap={{ scale: 0.97 }} onClick={() => go('/study/all')}>
            <span className="row" style={{ gap: 8 }}>
              <Play size={16} fill="currentColor" /> Повторить всё
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>все разделы подряд</span>
          </motion.button>
        )}
        {!live.length && (
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn primary" style={{ flex: 1 }} onClick={() => setNewSection(true)}>
              Создать раздел
            </button>
            <button className="btn secondary" onClick={() => go('/import')}>
              Импорт
            </button>
          </div>
        )}
      </motion.div>

      {plan.rows.length > 0 && (
        <>
          <div className="section-label">
            <span className="mono-label">План на сегодня</span>
          </div>
          <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...liquid, delay: 0.06 }} style={{ overflow: 'hidden' }}>
            {plan.rows.map(({ s, due, fresh, total }) => {
              const c = color(s.color)
              return (
                <motion.button key={s.id} className="plan-row" whileTap={{ scale: 0.98 }} onClick={() => go(`/study/s:${s.id}`)}>
                  <div className="ico-sq sm" style={{ '--c': c.from }}>
                    {s.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 680 }}>{s.name}</div>
                    <div className="small muted">
                      {[due && `${due} повторить`, fresh && `${fresh} ${plural(fresh, 'новая', 'новые', 'новых')}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className="mono-label" style={{ fontSize: 11 }}>
                    ~{mins(total, spc)} мин
                  </span>
                  <span className="play" style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})`, '--c': c.from }}>
                    <Play size={16} fill="currentColor" />
                  </span>
                </motion.button>
              )
            })}
          </motion.div>
        </>
      )}

      {live.length > 0 && (
        <>
          <div className="section-label">
            <span className="mono-label">Разделы</span>
            <button onClick={() => setNewSection(true)}>+ Раздел</button>
          </div>
          <div className="col" style={{ gap: 12 }}>
            {live.map((s, i) => (
              <SectionCard key={s.id} section={s} i={i} />
            ))}
          </div>
        </>
      )}

      <SectionEditor open={newSection} onClose={() => setNewSection(false)} />
      <CreateSheet open={create} onClose={() => setCreate(false)} onNewSection={() => setNewSection(true)} />
    </div>
  )
}

function SectionCard({ section, i }) {
  const decks = useStore((s) => s.decks)
  const notes = useStore((s) => s.notes)
  const days = useDays()
  const streaks = useSectionStreaks()
  const st = streaks[section.id]
  const c = color(section.color)

  const { total, mature } = useMemo(() => {
    let total = 0
    let mature = 0
    for (const n of Object.values(notes)) {
      const d = decks[n.deck_id]
      if (n.deleted || !d || d.deleted || d.section_id !== section.id) continue
      total++
      if (noteStatus(n, d).mature) mature++
    }
    return { total, mature }
  }, [notes, decks, section.id])

  const goal = section.goal || 10
  const level = (d) => {
    const n = days[d]?.sections[section.id] || 0
    return n ? Math.min(1, 0.25 + n / goal / 1.4) : 0
  }

  return (
    <motion.div
      className="tint-card habit-card"
      style={{ '--c': c.from }}
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...liquid, delay: 0.08 + i * 0.05 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => go(`/s/${section.id}`)}
    >
      <div className="top">
        <div className="ico-sq">{section.emoji || '📚'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{section.name}</h3>
          <div className="desc">
            {total} {plural(total, 'карточка', 'карточки', 'карточек')} · выучено {total ? Math.round((mature / total) * 100) : 0}%
          </div>
        </div>
        {st?.current > 0 && (
          <span className="chip" style={{ gap: 4 }}>
            <Flame size={14} animated={false} active={st.todayDone} /> {st.current}
          </span>
        )}
      </div>
      <DotGrid level={level} color={c.from} from={addDays(dayKey(), -400)} />
    </motion.div>
  )
}
