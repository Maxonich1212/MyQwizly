import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { useDays, useStreak, useSectionStreaks, useComposition } from '../lib/hooks'
import { sumRange, pctChange } from '../lib/stats'
import { dayKey, addDays, parseKey, WEEKDAYS, monthShort, fmtMinutes, plural, fmtDay } from '../lib/day'
import { gradient } from '../lib/palette'
import { plain } from '../lib/render'
import { go } from '../lib/ui'
import Icon from '../components/Icon'
import { Flame, Segmented, Counter, soft } from '../components/ui'
import { BarChart, Calendar } from '../components/Charts'

const fade = (i) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { ...soft, delay: 0.04 * i } })

export default function Stats() {
  const days = useDays()
  const settings = useStore((s) => s.settings)
  const sections = useStore((s) => s.sections)
  const decks = useStore((s) => s.decks)
  const notes = useStore((s) => s.notes)
  const streak = useStreak()
  const sectionStreaks = useSectionStreaks()
  const [period, setPeriod] = useState('week')
  const [metric, setMetric] = useState('n')
  const today = dayKey()
  const liveDecks = useMemo(() => Object.values(decks).filter((d) => !d.deleted).map((d) => d.id), [decks])
  const comp = useComposition(liveDecks)

  const chart = useMemo(() => {
    const val = (v) => (v ? (metric === 'n' ? v.n : Math.round(v.ms / 60000)) : 0)
    if (period === 'year') {
      const base = parseKey(today)
      return Array.from({ length: 12 }, (_, i) => {
        const m = new Date(base.getFullYear(), base.getMonth() - 11 + i, 1)
        const prefix = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
        let sum = 0
        for (const [k, v] of Object.entries(days)) if (k.startsWith(prefix)) sum += val(v)
        return { key: prefix, label: monthShort(m.getMonth()), value: sum, tip: `${monthShort(m.getMonth())}: ${sum}${metric === 'ms' ? ' мин' : ''}` }
      })
    }
    const n = period === 'week' ? 7 : 30
    return Array.from({ length: n }, (_, i) => {
      const k = addDays(today, i - n + 1)
      const d = parseKey(k)
      const v = val(days[k])
      return {
        key: k,
        label: period === 'week' ? WEEKDAYS[(d.getDay() + 6) % 7] : String(d.getDate()),
        value: v,
        tip: `${fmtDay(k)}: ${v}${metric === 'ms' ? ' мин' : ''}`,
      }
    })
  }, [days, period, metric, today])

  const total = chart.reduce((s, d) => s + d.value, 0)
  const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365

  // Отчёт: эта неделя против прошлой, этот месяц против прошлого
  const report = useMemo(() => {
    const cur = sumRange(days, addDays(today, -periodDays + 1), today)
    const prev = sumRange(days, addDays(today, -periodDays * 2 + 1), addDays(today, -periodDays))
    return { cur, prev }
  }, [days, today, periodDays])

  const hardest = useMemo(() => {
    const list = []
    for (const n of Object.values(notes)) {
      if (n.deleted || decks[n.deck_id]?.deleted) continue
      const lapses = Object.values(n.srs || {}).reduce((s, c) => s + (c.lapses || 0), 0)
      if (lapses > 0) list.push({ n, lapses })
    }
    return list.sort((a, b) => b.lapses - a.lapses).slice(0, 5)
  }, [notes, decks])

  const todayStats = days[today] || { n: 0, ms: 0, correct: 0 }
  const acc = report.cur.n ? Math.round((report.cur.correct / report.cur.n) * 100) : 0
  const prevAcc = report.prev.n ? Math.round((report.prev.correct / report.prev.n) * 100) : 0
  const label = period === 'week' ? 'неделю' : period === 'month' ? 'месяц' : 'год'
  const liveSections = Object.values(sections).filter((s) => !s.deleted).sort((a, b) => a.sort - b.sort)

  return (
    <div className="screen">
      <h1 className="title" style={{ marginBottom: 18 }}>
        Статистика
      </h1>

      <motion.div className="card hero" {...fade(0)}>
        <div className="row" style={{ gap: 16 }}>
          <Flame size={64} active={streak.current > 0} animated={streak.todayDone} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
              <Counter value={streak.current} />
            </div>
            <div className="muted" style={{ fontWeight: 600 }}>
              {plural(streak.current, 'день', 'дня', 'дней')} подряд{streak.todayDone ? '' : ' · сегодня ещё не засчитан'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="small faint">рекорд</div>
            <div style={{ fontWeight: 760, fontSize: 20 }}>{streak.best}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 16, gap: 8 }}>
          {Array.from({ length: settings.freezesPerWeek }, (_, i) => (
            <span key={i} className="chip" style={i < (streak.freezesLeft ?? settings.freezesPerWeek) ? { color: 'var(--frost)' } : { opacity: 0.45 }}>
              <Icon name="snow" size={14} /> заморозка
            </span>
          ))}
          <span className="small faint">на этой неделе</span>
        </div>
      </motion.div>

      <motion.div className="kpis" style={{ marginTop: 12 }} {...fade(1)}>
        <Kpi icon="bolt" label="Сегодня" value={todayStats.n} suffix={plural(todayStats.n, ' карточка', ' карточки', ' карточек')} />
        <Kpi icon="clock" label="Время сегодня" value={Math.round(todayStats.ms / 60000)} suffix=" мин" />
        <Kpi icon="target" label={`Точность за ${label}`} value={acc} suffix="%" delta={report.prev.n ? acc - prevAcc : null} />
        <Kpi icon="layers" label="Выучено" value={comp.mature} suffix={` из ${comp.total}`} />
      </motion.div>

      <motion.div className="card pad" style={{ marginTop: 12 }} {...fade(2)}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'week', label: 'Неделя' },
              { value: 'month', label: 'Месяц' },
              { value: 'year', label: 'Год' },
            ]}
          />
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'n', label: 'Карточки' },
              { value: 'ms', label: 'Минуты' },
            ]}
          />
        </div>
        <div className="chart-head">
          <div>
            <div className="big tnum">
              <Counter value={total} />
              <span className="small faint" style={{ fontWeight: 600, letterSpacing: 0, marginLeft: 6 }}>
                {metric === 'n' ? plural(total, 'карточка', 'карточки', 'карточек') : 'мин'}
              </span>
            </div>
            <div className="small faint" style={{ marginTop: 4 }}>
              в среднем {Math.round(total / (period === 'year' ? 12 : chart.length))} {period === 'year' ? 'в месяц' : 'в день'}
            </div>
          </div>
          <Delta value={pctChange(metric === 'n' ? report.cur.n : report.cur.ms, metric === 'n' ? report.prev.n : report.prev.ms)} suffix={`к прошл. ${period === 'week' ? 'неделе' : period === 'month' ? 'месяцу' : 'году'}`} />
        </div>
        <BarChart key={period + metric} data={chart} />
      </motion.div>

      {/* Календарь — компактный, без карточки вокруг */}
      <motion.div className="mini-cal-wrap" {...fade(3)}>
        <Calendar days={days} frozen={streak.frozen} />
      </motion.div>

      <div className="section-label">Отчёт за {label}</div>
      <motion.div className="card" {...fade(4)}>
        <ReportRow label="Карточек повторено" cur={report.cur.n} prev={report.prev.n} />
        <ReportRow label="Время учёбы" cur={report.cur.ms} prev={report.prev.ms} fmt={fmtMinutes} />
        <ReportRow label="Новых слов и вопросов" cur={report.cur.fresh} prev={report.prev.fresh} />
        <ReportRow label="Дней с учёбой" cur={report.cur.active} prev={report.prev.active} fmt={(v) => `${v} из ${periodDays}`} />
      </motion.div>

      {liveSections.length > 0 && (
        <>
          <div className="section-label">По разделам</div>
          <motion.div className="card" {...fade(5)}>
            {liveSections.map((s) => (
              <SectionReport key={s.id} section={s} days={days} streak={sectionStreaks[s.id]} />
            ))}
          </motion.div>
        </>
      )}

      {hardest.length > 0 && (
        <>
          <div className="section-label">Самые трудные</div>
          <div className="card list">
            {hardest.map(({ n, lapses }) => (
              <button key={n.id} className="list-item" onClick={() => go(`/d/${n.deck_id}`)}>
                <div className="main">
                  <div className="t">{plain(n.front, 80)}</div>
                  <div className="s">{decks[n.deck_id]?.name}</div>
                </div>
                <span className="chip" style={{ color: 'var(--again)' }}>
                  ✕ {lapses}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ icon, label, value, suffix, delta }) {
  return (
    <div className="card kpi">
      <div className="l">
        <Icon name={icon} size={15} /> {label}
      </div>
      <div className="v">
        <Counter value={value} />
        <span className="small faint" style={{ fontWeight: 600, letterSpacing: 0 }}>
          {suffix}
        </span>
        {delta != null && delta !== 0 && <span className={`delta ${delta > 0 ? 'up' : 'down'}`}>{delta > 0 ? `+${delta}` : delta}</span>}
      </div>
    </div>
  )
}

function Delta({ value, suffix }) {
  if (value == null) return <span className="chip accent">новый рекорд</span>
  if (value === 0) return null
  return (
    <div style={{ textAlign: 'right' }}>
      <div className={`delta ${value > 0 ? 'up' : 'down'}`} style={{ fontSize: 15, margin: 0 }}>
        {value > 0 ? '▲' : '▼'} {Math.abs(value)}%
      </div>
      <div className="small faint">{suffix}</div>
    </div>
  )
}

function ReportRow({ label, cur, prev, fmt = (v) => v }) {
  const d = pctChange(cur, prev)
  return (
    <div className="report-row">
      <div style={{ flex: 1 }} className="muted">
        {label}
      </div>
      <b className="tnum">{fmt(cur)}</b>
      <span className={`delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`} style={{ minWidth: 48, textAlign: 'right' }}>
        {d == null ? (cur ? 'new' : '') : d === 0 ? '—' : `${d > 0 ? '+' : ''}${d}%`}
      </span>
    </div>
  )
}

function SectionReport({ section, days, streak }) {
  const today = dayKey()
  const series = Array.from({ length: 14 }, (_, i) => days[addDays(today, i - 13)]?.sections[section.id] || 0)
  const max = Math.max(1, ...series)
  const week = series.slice(7).reduce((a, b) => a + b, 0)
  return (
    <button className="report-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => go(`/s/${section.id}`)}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: gradient(section.color), display: 'grid', placeItems: 'center', fontSize: 20 }}>{section.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 650 }}>{section.name}</div>
        <div className="small faint row" style={{ gap: 4 }}>
          {week} за 7 дней
          {streak?.current > 0 && (
            <>
              · <Flame size={12} animated={false} active={streak.todayDone} /> {streak.current}
            </>
          )}
        </div>
      </div>
      <div className="mini-bars">
        {series.map((v, i) => (
          <motion.i key={i} style={{ background: v ? gradient(section.color, 180) : 'var(--surface-3)' }} initial={{ height: 2 }} animate={{ height: `${Math.max(2, (v / max) * 22)}px` }} transition={{ delay: i * 0.02, type: 'spring', stiffness: 200, damping: 20 }} />
        ))}
      </div>
    </button>
  )
}
