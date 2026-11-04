import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, ChevronLeft, ChevronRight, Flame, Trophy, Percent, CheckCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import { useHabitLogs, habitStats, progressOf, isScheduled, tapHabit, createdDay, repeatLabel, targetOf } from '../lib/habits'
import { dayKey, parseKey, monthName, WEEKDAYS, fmtDay, plural, toKey } from '../lib/day'
import HabitIcon from '../components/HabitIcon'
import { TopBar, Counter } from '../components/ui'
import { DotGrid, LiquidCheck, liquid } from '../components/fluid'
import { HabitEditor, ValueSheet } from '../components/HabitEditor'
import { Missing } from './Section'

export default function HabitDetail({ id }) {
  const h = useStore((s) => s.habits[id])
  const all = useHabitLogs()
  const logs = useMemo(() => all[id] || {}, [all, id])
  const [edit, setEdit] = useState(false)
  const [valueFor, setValueFor] = useState(null)
  const st = useMemo(() => (h ? habitStats(h, logs) : null), [h, logs])
  if (!h || h.deleted) return <Missing />

  const today = dayKey()
  const tap = (d) => (h.tracking === 'measure' && h.kind !== 'quit' ? setValueFor({ h, day: d }) : tapHabit(h, d))
  const notes = Object.values(logs)
    .filter((l) => l.note)
    .sort((a, b) => (a.day < b.day ? 1 : -1))
  const unit = st.unit === 'week' ? ['неделя', 'недели', 'недель'] : ['день', 'дня', 'дней']

  return (
    <div className="screen" style={{ '--c': h.color }}>
      <TopBar
        fallback="/"
        right={
          <button className="icon-btn" onClick={() => setEdit(true)} aria-label="Изменить">
            <Pencil size={18} />
          </button>
        }
      />
      <motion.div className="tint-card habit-card" style={{ '--c': h.color, padding: 20 }} initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={liquid}>
        <div className="top">
          <div className="ico-sq" style={{ width: 60, height: 60, borderRadius: 18 }}>
            <HabitIcon name={h.icon} size={28} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 22 }}>{h.name}</h3>
            <div className="desc">{h.description || repeatLabel(h)}</div>
          </div>
          <LiquidCheck progress={progressOf(h, logs[today])} color={h.color} onTap={() => tap(today)} size={58} label={h.tracking !== 'check' && h.kind !== 'quit' ? `${logs[today]?.value || 0}/${targetOf(h)}` : null} />
        </div>
        <DotGrid level={(d) => (isScheduled(h, d) ? progressOf(h, logs[d]) : null)} color={h.color} from={createdDay(h)} dot={11} gap={3} />
      </motion.div>

      <div className="kpis" style={{ marginTop: 12 }}>
        <Stat icon={<Flame size={15} />} label="Серия" value={st.current} suffix={` ${plural(st.current, ...unit)}`} color={h.color} />
        <Stat icon={<Trophy size={15} />} label="Лучшая" value={st.best} suffix={` ${plural(st.best, ...unit)}`} />
        <Stat icon={<Percent size={15} />} label="За 30 дней" value={Math.round(st.rate * 100)} suffix="%" />
        <Stat icon={<CheckCheck size={15} />} label={h.kind === 'quit' ? 'Чистых дней' : 'Выполнено'} value={st.total} suffix={` ${plural(st.total, 'раз', 'раза', 'раз')}`} />
      </div>

      <div className="section-label">Календарь</div>
      <motion.div className="card pad" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...liquid, delay: 0.08 }}>
        <MonthToggle h={h} logs={logs} onTap={tap} />
      </motion.div>

      {notes.length > 0 && (
        <>
          <div className="section-label">Заметки</div>
          <div className="card list">
            {notes.map((l) => (
              <div key={l.id} className="list-item">
                <div className="main">
                  <div className="mono-label" style={{ fontSize: 10.5 }}>
                    {fmtDay(l.day)}
                  </div>
                  <div style={{ marginTop: 2 }}>{l.note}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <HabitEditor open={edit} habit={h} onClose={() => setEdit(false)} />
      <ValueSheet target={valueFor} logs={all} onClose={() => setValueFor(null)} />
    </div>
  )
}

function Stat({ icon, label, value, suffix, color }) {
  return (
    <div className="card kpi">
      <div className="l" style={color ? { color } : undefined}>
        {icon} {label}
      </div>
      <div className="v">
        <Counter value={value} />
        <span className="small faint" style={{ fontWeight: 600, letterSpacing: 0 }}>
          {suffix}
        </span>
      </div>
    </div>
  )
}

// Календарь, где можно отметить любой прошедший день
function MonthToggle({ h, logs, onTap }) {
  const [offset, setOffset] = useState(0)
  const [dir, setDir] = useState(0)
  const base = parseKey(dayKey())
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1, 12)
  const lead = (first.getDay() + 6) % 7
  const n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const today = dayKey()
  const from = createdDay(h)
  const shift = (d) => {
    setDir(d)
    setOffset((o) => o + d)
  }
  return (
    <>
      <div className="cal-head">
        <button className="icon-btn ghost" onClick={() => shift(-1)} aria-label="Назад">
          <ChevronLeft size={20} />
        </button>
        <b>
          {monthName(first.getMonth())} {first.getFullYear()}
        </b>
        <button className="icon-btn ghost" onClick={() => shift(1)} disabled={offset >= 0} style={{ opacity: offset >= 0 ? 0.3 : 1 }} aria-label="Вперёд">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="cal">
        {WEEKDAYS.map((w) => (
          <div key={w} className="wd">
            {w}
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={offset} className="cal" initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -24 }} transition={liquid}>
          {Array.from({ length: lead }, (_, i) => (
            <div key={`p${i}`} className="d out" />
          ))}
          {Array.from({ length: n }, (_, i) => {
            const k = toKey(new Date(first.getFullYear(), first.getMonth(), i + 1, 12))
            const future = k > today
            const off = k < from || !isScheduled(h, k)
            const p = future ? 0 : progressOf(h, logs[k])
            const active = !future && !(k < from)
            return (
              <motion.button
                key={k}
                className={`d ${future ? 'future' : ''} ${k === today ? 'today' : ''}`}
                disabled={!active}
                onClick={() => onTap(k)}
                whileTap={{ scale: 0.85 }}
                style={{ overflow: 'hidden', opacity: off && !p ? 0.45 : 1, color: p >= 1 ? '#fff' : undefined }}
              >
                <motion.i
                  style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: h.color }}
                  initial={false}
                  animate={{ height: `${p * 100}%` }}
                  transition={liquid}
                />
                <span style={{ position: 'relative' }}>{i + 1}</span>
              </motion.button>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </>
  )
}
