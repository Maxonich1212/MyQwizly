import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { useDue, useStreak, useToday, useSectionStreaks, greeting } from '../lib/hooks'
import { go } from '../lib/ui'
import { gradient, color } from '../lib/palette'
import { goalFor } from '../lib/stats'
import { dayKey, fmtDay, plural } from '../lib/day'
import { noteStatus } from '../lib/srs'
import Icon from '../components/Icon'
import { Ring, Flame, Counter, Pressable, soft } from '../components/ui'
import { SectionEditor } from '../components/Editors'

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: soft } }

export default function Home() {
  const sections = useStore((s) => s.sections)
  const settings = useStore((s) => s.settings)
  const streak = useStreak()
  const today = useToday()
  const due = useDue({ all: true })
  const [editor, setEditor] = useState(false)
  const goal = goalFor(settings, dayKey())
  const live = useMemo(() => Object.values(sections).filter((s) => !s.deleted).sort((a, b) => a.sort - b.sort), [sections])

  return (
    <div className="screen">
      <motion.div className="row" style={{ alignItems: 'flex-start', marginBottom: 18 }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={soft}>
        <div className="grow" style={{ flex: 1 }}>
          <p className="subtitle" style={{ fontWeight: 600 }}>{fmtDay(dayKey())}</p>
          <h1 className="title">{greeting()}</h1>
        </div>
        <Pressable className={`streak-chip ${streak.todayDone ? '' : 'cold'}`} onClick={() => go('/stats')} style={{ marginTop: 6 }}>
          <Flame size={22} active={streak.current > 0} animated={streak.todayDone} />
          <Counter value={streak.current} />
        </Pressable>
      </motion.div>

      <motion.div className="card hero" initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...soft, delay: 0.04 }}>
        <div className="hero-grid">
          <Ring value={today.n / goal} size={124} stroke={12}>
            <div>
              <b>
                <Counter value={today.n} />
              </b>
              <small>из {goal}</small>
            </div>
          </Ring>
          <div>
            <div className="stat-line">
              <div>
                <b className="tnum">{due.due}</b>
                <span>повторить</span>
              </div>
              <div>
                <b className="tnum">{due.fresh}</b>
                <span>{plural(due.fresh, 'новая', 'новые', 'новых')}</span>
              </div>
            </div>
            {due.total > 0 ? (
              <button className="btn primary block" onClick={() => go('/study/all')}>
                <Icon name="play" size={16} /> Учиться
              </button>
            ) : (
              <div className="muted small" style={{ lineHeight: 1.4 }}>
                {live.length ? (due.soon ? `Скоро вернутся ${due.soon} — загляни через пару минут` : 'На сегодня всё повторено 🎉') : 'Создай раздел или импортируй колоду'}
              </div>
            )}
          </div>
        </div>
        {streak.todayDone ? null : today.n > 0 ? (
          <div className="small muted" style={{ marginTop: 14 }}>
            До цели дня ещё {goal - today.n} {plural(goal - today.n, 'карточка', 'карточки', 'карточек')} — и огонёк загорится
          </div>
        ) : null}
      </motion.div>

      <div className="section-label">
        Разделы
        <button onClick={() => setEditor(true)}>+ Новый</button>
      </div>

      {live.length === 0 ? (
        <motion.div className="card empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="big">🗂️</div>
          <h3>Пока пусто</h3>
          <p className="muted" style={{ margin: '0 0 18px' }}>
            Раздел — это большая тема: «Собеседование», «Английский». Внутри — колоды с карточками.
          </p>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => setEditor(true)}>
              <Icon name="plus" size={18} /> Создать раздел
            </button>
            <button className="btn secondary" onClick={() => go('/import')}>
              <Icon name="upload" size={18} /> Импорт
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div className="sections" variants={list} initial="hidden" animate="show">
          {live.map((s) => (
            <motion.div key={s.id} variants={item} layout>
              <SectionCard section={s} />
            </motion.div>
          ))}
        </motion.div>
      )}

      <SectionEditor open={editor} onClose={() => setEditor(false)} />
    </div>
  )
}

function SectionCard({ section }) {
  const decks = useStore((s) => s.decks)
  const notes = useStore((s) => s.notes)
  const due = useDue({ sectionId: section.id })
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

  return (
    <Pressable className="card section-card" onClick={() => go(`/s/${section.id}`)}>
      <div className="emoji" style={{ background: gradient(section.color), '--glow': c.from }}>
        {section.emoji || '📚'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <h3>{section.name}</h3>
          {st?.current > 0 && (
            <span className="chip" style={{ padding: '2px 8px 2px 5px', gap: 3 }}>
              <Flame size={14} animated={false} active={st.todayDone} />
              {st.current}
            </span>
          )}
        </div>
        <div className="small muted">
          {total} {plural(total, 'карточка', 'карточки', 'карточек')} · выучено {total ? Math.round((mature / total) * 100) : 0}%
        </div>
        <div className="progress">
          <motion.i
            style={{ background: gradient(section.color, 90) }}
            initial={{ width: 0 }}
            animate={{ width: `${total ? Math.max(2, (mature / total) * 100) : 0}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
        </div>
      </div>
      <div className={`due-badge ${due.total ? '' : 'zero'}`} style={due.total ? { background: gradient(section.color) } : undefined}>
        {due.total || <Icon name="check" size={16} stroke={2.6} />}
      </div>
    </Pressable>
  )
}
