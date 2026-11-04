import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WEEKDAYS, monthName, toKey, dayKey, parseKey } from '../lib/day'
import Icon from './Icon'

// Столбики с подсказкой по тапу и пунктирной линией цели
export function BarChart({ data, goal, height = 160, fill = 'linear-gradient(180deg, #8b5cf6, #6366f1)', format = (v) => v }) {
  const [active, setActive] = useState(null)
  const max = Math.max(1, goal || 0, ...data.map((d) => d.value)) * 1.08
  const dense = data.length > 16
  return (
    <div onMouseLeave={() => setActive(null)}>
      <div className="bars" style={{ height, gap: dense ? 3 : 6 }}>
        {goal ? (
          <div className="goal-line" style={{ bottom: `${(goal / max) * 100}%` }}>
            <span>цель {goal}</span>
          </div>
        ) : null}
        {data.map((d, i) => (
          <div
            key={d.key}
            className={`b ${d.value ? '' : 'zero'}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(active === i ? null : i)}
          >
            <AnimatePresence>
              {active === i && (
                <motion.div className="tip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ bottom: `calc(${(d.value / max) * 100}% + 8px)` }}>
                  {d.tip || format(d.value)}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div
              className="fill"
              style={{
                background: d.color || fill,
                opacity: active == null || active === i ? 1 : 0.45,
                borderRadius: dense ? '4px 4px 2px 2px' : undefined,
                transition: 'opacity .2s',
              }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(d.value ? 3 : 2, (d.value / max) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 170, damping: 22, delay: i * (dense ? 0.012 : 0.035) }}
            />
          </div>
        ))}
      </div>
      <div className="axis" style={{ gap: dense ? 3 : 6 }}>
        {data.map((d, i) => (
          <span key={d.key}>{!dense || i % 5 === 0 || i === data.length - 1 ? d.label : ''}</span>
        ))}
      </div>
    </div>
  )
}

// Минималистичный календарь месяца: насыщенность = объём, ❄ — день спасён заморозкой
export function Calendar({ days, goalOf, frozen }) {
  const [offset, setOffset] = useState(0)
  const [dirn, setDirn] = useState(0)
  const base = parseKey(dayKey())
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1, 12)
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const today = dayKey()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysIn; d++) cells.push(toKey(new Date(first.getFullYear(), first.getMonth(), d, 12)))

  let studied = 0
  const level = (k) => {
    const n = days[k]?.n || 0
    if (!n) return 0
    const g = goalOf(k)
    if (n >= g * 2) return 4
    if (n >= g) return 3
    if (n >= g / 2) return 2
    return 1
  }
  for (const k of cells) if (k && days[k]?.n) studied++

  const shift = (d) => {
    setDirn(d)
    setOffset((o) => o + d)
  }

  return (
    <div>
      <div className="cal-head">
        <button className="icon-btn ghost" onClick={() => shift(-1)} aria-label="Предыдущий месяц">
          <Icon name="back" size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <b>
            {monthName(first.getMonth())} {first.getFullYear() !== base.getFullYear() ? first.getFullYear() : ''}
          </b>
          <div className="small faint">
            учился {studied} из {offset === 0 ? base.getDate() : daysIn} дн.
          </div>
        </div>
        <button className="icon-btn ghost" onClick={() => shift(1)} disabled={offset >= 0} style={{ opacity: offset >= 0 ? 0.3 : 1 }} aria-label="Следующий месяц">
          <Icon name="chevron" size={20} />
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
        <motion.div
          key={offset}
          className="cal"
          initial={{ opacity: 0, x: dirn * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dirn * -24 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {cells.map((k, i) => {
            if (!k) return <div key={`o${i}`} className="d out" />
            const lv = level(k)
            const fr = frozen.has(k)
            const cls = ['d', k > today ? 'future' : '', lv ? `lvl${lv}` : '', fr && !lv ? 'frozen' : '', k === today ? 'today' : ''].join(' ')
            return (
              <div key={k} className={`${cls} pop-in`} title={days[k] ? `${days[k].n} карточек` : ''} style={{ animationDelay: `${i * 8}ms` }}>
                {Number(k.slice(8))}
                {fr && !lv && <span className="ico">❄</span>}
              </div>
            )
          })}
        </motion.div>
      </AnimatePresence>
      <div className="legend">
        меньше
        <i style={{ background: 'var(--surface-2)' }} />
        <i className="lvl" style={{ background: 'color-mix(in srgb, var(--accent) 22%, var(--surface))' }} />
        <i style={{ background: 'color-mix(in srgb, var(--accent) 45%, var(--surface))' }} />
        <i style={{ background: 'color-mix(in srgb, var(--accent) 75%, var(--surface))' }} />
        <i style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }} />
        больше
      </div>
    </div>
  )
}
