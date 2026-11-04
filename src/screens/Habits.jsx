import { useMemo, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Plus, LayoutGrid, ListChecks, CalendarDays, CalendarCheck, StickyNote, Pencil, ArrowUpDown, Archive, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { patch, remove } from '../lib/store'
import { useHabits, useHabitLogs, progressOf, isScheduled, tapHabit, habitStats, targetOf, createdDay, setNote } from '../lib/habits'
import { addDays, dayKey, parseKey, fmtDay, monthName, plural } from '../lib/day'
import { go } from '../lib/ui'
import HabitIcon from '../components/HabitIcon'
import { promptDialog, confirmDialog } from '../components/Dialog'
import { LiquidCheck, DotGrid, MonthDots, ContextMenu, Pills, useLongPress, liquid } from '../components/fluid'
import { HabitEditor, ValueSheet } from '../components/HabitEditor'

const VIEWS = [
  { value: 'grid', icon: LayoutGrid },
  { value: 'week', icon: ListChecks },
  { value: 'month', icon: CalendarDays },
]

const TEMPLATES = [
  { name: 'Зарядка', icon: 'activity', color: '#f4c34a' },
  { name: 'LeetCode', icon: 'code', color: '#6fd98a', description: 'Одна задача в день' },
  { name: 'Английский', icon: 'lang', color: '#5ab1f5', description: 'Карточки в MyQwizly' },
  { name: 'Чтение', icon: 'book', color: '#a284f5', tracking: 'count', target: 20, unit: 'стр' },
  { name: 'Вода', icon: 'water', color: '#5ccbe8', tracking: 'count', target: 8, unit: 'стак.' },
  { name: 'Без соцсетей', icon: 'screen', color: '#f2706b', kind: 'quit' },
]

export default function Habits() {
  const habits = useHabits()
  const logs = useHabitLogs()
  const [view, setView] = useState(() => localStorage.getItem('mq-hview') || 'grid')
  const [cat, setCat] = useState('all')
  const [editor, setEditor] = useState(null) // null | {} (новая) | habit | шаблон
  const [menu, setMenu] = useState(null)
  const [valueFor, setValueFor] = useState(null)

  const cats = useMemo(() => [...new Set(habits.map((h) => h.category).filter(Boolean))], [habits])
  const list = cat === 'all' ? habits : habits.filter((h) => h.category === cat)
  const doneToday = habits.filter((h) => isScheduled(h, dayKey()) && progressOf(h, logs[h.id]?.[dayKey()]) >= 1).length
  const dueToday = habits.filter((h) => isScheduled(h, dayKey())).length

  const changeView = (v) => {
    setView(v)
    localStorage.setItem('mq-hview', v)
  }

  const tap = (h, day) => (h.tracking === 'measure' && h.kind !== 'quit' ? setValueFor({ h, day }) : tapHabit(h, day))

  function openMenu(h, at) {
    const idx = habits.findIndex((x) => x.id === h.id)
    setMenu({
      at,
      items: [
        { label: 'Отметить вчера', icon: <CalendarCheck size={20} />, onClick: () => tap(h, addDays(dayKey(), -1)) },
        {
          label: 'Заметка на сегодня',
          icon: <StickyNote size={20} />,
          onClick: async () => {
            const n = await promptDialog({ title: 'Заметка на сегодня', value: logs[h.id]?.[dayKey()]?.note || '', placeholder: 'Как прошло?', ok: 'Сохранить' })
            if (n != null) setNote(h, dayKey(), n.trim())
          },
        },
        { label: 'Изменить', icon: <Pencil size={20} />, onClick: () => setEditor(h) },
        {
          label: idx > 0 ? 'Поднять выше' : 'Опустить ниже',
          icon: <ArrowUpDown size={20} />,
          onClick: () => {
            const other = habits[idx > 0 ? idx - 1 : idx + 1]
            if (!other) return
            patch('habits', h.id, { sort: other.sort })
            patch('habits', other.id, { sort: h.sort })
          },
        },
        '-',
        { label: 'В архив', icon: <Archive size={20} />, onClick: () => patch('habits', h.id, { archived: true }) },
        { label: 'Удалить', icon: <Trash2 size={20} />, danger: true, onClick: async () => (await confirmDialog({ title: `Удалить «${h.name}»?`, text: 'Привычка попадёт в корзину — вернуть можно в Настройках.', ok: 'Удалить', danger: true })) && remove('habits', h.id) },
      ],
    })
  }

  return (
    <div className="screen">
      <div className="head">
        <div className="grow">
          <div className="mono-label">
            {dueToday ? `Сегодня ${doneToday} из ${dueToday}` : fmtDay(dayKey())}
          </div>
          <h1 className="title" style={{ margin: '4px 0 0' }}>
            Привычки
          </h1>
        </div>
        <motion.button className="add-pill shine" whileTap={{ scale: 0.93 }} transition={liquid} onClick={() => setEditor({})} aria-label="Новая привычка">
          <span className="add-ico">
            <Plus size={17} strokeWidth={2.8} />
          </span>
          Привычка
        </motion.button>
      </div>

      {habits.length > 0 && (
        <div className="row" style={{ marginBottom: 14, gap: 10 }}>
          <div className="view-switch">
            {VIEWS.map((v) => (
              <button key={v.value} className={view === v.value ? 'on' : ''} onClick={() => changeView(v.value)} aria-label={v.value}>
                {view === v.value && <motion.span layoutId="hview" className="vs-thumb" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <v.icon size={18} />
              </button>
            ))}
          </div>
        </div>
      )}

      {cats.length > 0 && (
        <Pills
          id="hcat"
          value={cat}
          onChange={setCat}
          items={[{ value: 'all', label: 'Все' }, ...cats.map((c) => ({ value: c, label: c }))]}
        />
      )}

      {habits.length === 0 ? (
        <Empty onCreate={(t) => setEditor(t || {})} />
      ) : (
        <LayoutGroup>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              {view === 'grid' && (
                <div className="col" style={{ gap: 12 }}>
                  <AnimatePresence initial={false}>
                    {list.map((h, i) => (
                      <HabitCard key={h.id} h={h} logs={logs[h.id] || {}} i={i} onTap={(d) => tap(h, d)} onMenu={(at) => openMenu(h, at)} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
              {view === 'week' && <WeekView list={list} logs={logs} onTap={tap} onMenu={openMenu} />}
              {view === 'month' && <MonthView list={list} logs={logs} onTap={tap} onMenu={openMenu} />}
            </motion.div>
          </AnimatePresence>
        </LayoutGroup>
      )}

      <ContextMenu at={menu?.at} items={menu?.items || []} onClose={() => setMenu(null)} />
      <HabitEditor open={!!editor} habit={editor?.id ? editor : null} preset={editor && !editor.id ? editor : null} onClose={() => setEditor(null)} categories={cats} />
      <ValueSheet target={valueFor} logs={logs} onClose={() => setValueFor(null)} />
    </div>
  )
}

function HabitCard({ h, logs, i, onTap, onMenu }) {
  const today = dayKey()
  const st = useMemo(() => habitStats(h, logs), [h, logs])
  const log = logs[today]
  const p = progressOf(h, log)
  const lp = useLongPress(onMenu)
  const scheduled = isScheduled(h, today)
  const countLabel = h.tracking !== 'check' && h.kind !== 'quit' ? `${log?.value || 0}/${targetOf(h)}` : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: Math.min(i, 6) * 0.04 }}
      className="tint-card habit-card"
      style={{ '--c': h.color }}
      onClick={() => !lp.fired() && go(`/h/${h.id}`)}
      {...lp.handlers}
      whileTap={{ scale: 0.985 }}
    >
      <div className="top">
        <div className="ico-sq">
          <HabitIcon name={h.icon} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{h.name}</h3>
          {h.description && <div className="desc">{h.description}</div>}
        </div>
        {scheduled || p > 0 ? (
          <LiquidCheck progress={p} color={h.color} onTap={() => onTap(today)} label={countLabel} onLongPress={onMenu} />
        ) : (
          <span className="mono-label" style={{ fontSize: 10 }}>
            выходной
          </span>
        )}
      </div>
      <DotGrid level={(d) => (isScheduled(h, d) ? progressOf(h, logs[d]) : null)} color={h.color} from={createdDay(h)} />
      <div className="row mono-label" style={{ marginTop: 12, fontSize: 10.5, gap: 14 }}>
        <span style={{ color: st.current ? h.color : undefined }}>
          ● серия {st.current} {st.unit === 'week' ? 'нед' : 'дн'}
        </span>
        <span>лучшая {st.best}</span>
        <span className="spacer" />
        <span>{Math.round(st.rate * 100)}% · 30 дн</span>
      </div>
    </motion.div>
  )
}

function WeekView({ list, logs, onTap, onMenu }) {
  const today = dayKey()
  const days = Array.from({ length: 5 }, (_, i) => addDays(today, i - 4))
  const wdn = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="pill" style={{ height: 34 }}>
          Последние 5 дней
        </span>
        <span className="mono-label">
          {days[0].slice(8)}.{days[0].slice(5, 7)} — {today.slice(8)}.{today.slice(5, 7)}
        </span>
      </div>
      <div className="card week-table">
        <div className="week-row" style={{ paddingTop: 14, paddingBottom: 12 }}>
          <span className="mono-label">
            {list.length} {plural(list.length, 'привычка', 'привычки', 'привычек')}
          </span>
          {days.map((d) => (
            <div key={d} className={`week-head ${d === today ? 'today' : ''}`}>
              {wdn[parseKey(d).getDay()]}
              <b>{Number(d.slice(8))}</b>
            </div>
          ))}
        </div>
        {list.map((h) => (
          <WeekRow key={h.id} h={h} logs={logs[h.id] || {}} days={days} onTap={onTap} onMenu={onMenu} />
        ))}
      </div>
    </>
  )
}

function WeekRow({ h, logs, days, onTap, onMenu }) {
  const lp = useLongPress((at) => onMenu(h, at))
  return (
    <div className="week-row" style={{ '--c': h.color }}>
      <button className="name" onClick={() => !lp.fired() && go(`/h/${h.id}`)} {...lp.handlers}>
        <div className="ico-sq sm">
          <HabitIcon name={h.icon} size={16} />
        </div>
        <span>{h.name}</span>
      </button>
      {days.map((d) => {
        const before = d < createdDay(h)
        const sched = isScheduled(h, d)
        const p = progressOf(h, logs[d])
        if (before || !sched) return <div key={d} className="cell off" />
        return (
          <motion.button key={d} className="cell" whileTap={{ scale: 0.85 }} transition={liquid} onClick={() => onTap(h, d)} aria-label={d}>
            <motion.i
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: h.color, borderRadius: 11 }}
              initial={false}
              animate={{ height: `${p * 100}%`, opacity: p > 0 ? 1 : 0 }}
              transition={liquid}
            />
          </motion.button>
        )
      })}
    </div>
  )
}

function MonthView({ list, logs, onMenu }) {
  const [offset, setOffset] = useState(0)
  const base = parseKey(dayKey())
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1, 12)
  return (
    <>
      <div className="row" style={{ marginBottom: 12, gap: 8 }}>
        <button className="round" style={{ width: 38, height: 38 }} onClick={() => setOffset(offset - 1)} aria-label="Назад">
          <ChevronLeft size={18} />
        </button>
        <span className="pill" style={{ height: 38 }}>
          {monthName(month.getMonth())} {month.getFullYear()}
        </span>
        <button className="round" style={{ width: 38, height: 38, opacity: offset >= 0 ? 0.35 : 1 }} disabled={offset >= 0} onClick={() => setOffset(offset + 1)} aria-label="Вперёд">
          <ChevronRight size={18} />
        </button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={offset} className="tiles" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={liquid}>
          {list.map((h) => (
            <MonthTile key={h.id} h={h} logs={logs[h.id] || {}} month={month} onMenu={onMenu} />
          ))}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

function MonthTile({ h, logs, month, onMenu }) {
  const lp = useLongPress((at) => onMenu(h, at))
  const p = progressOf(h, logs[dayKey()])
  return (
    <motion.div className="tint-card tile" style={{ '--c': h.color }} onClick={() => !lp.fired() && go(`/h/${h.id}`)} {...lp.handlers} whileTap={{ scale: 0.97 }} transition={liquid}>
      <div className="t-head">
        <LiquidCheck round size={28} progress={p} color={h.color} onTap={() => tapHabit(h)} />
        <span>{h.name}</span>
      </div>
      <MonthDots month={month} color={h.color} level={(d) => (d < createdDay(h) || !isScheduled(h, d) ? 0 : progressOf(h, logs[d]))} />
    </motion.div>
  )
}

function Empty({ onCreate }) {
  const demo = (d) => {
    const n = Number(d.slice(8)) + Number(d.slice(5, 7)) * 3
    return n % 3 === 0 ? 0 : (n % 5) / 4
  }
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={liquid}>
      <div className="tint-card habit-card" style={{ '--c': '#8487f5', marginBottom: 18 }}>
        <div className="top">
          <div className="ico-sq">
            <HabitIcon name="sparkles" />
          </div>
          <div style={{ flex: 1 }}>
            <h3>Первая привычка</h3>
            <div className="desc">Отмечай каждый день — точки сложатся в картину</div>
          </div>
        </div>
        <DotGrid level={demo} color="#8487f5" />
      </div>
      <div className="mono-label" style={{ margin: '0 4px 10px' }}>
        Быстрый старт
      </div>
      <div className="chips" style={{ flexWrap: 'wrap', overflow: 'visible' }}>
        {TEMPLATES.map((t) => (
          <motion.button key={t.name} className="pill" whileTap={{ scale: 0.94 }} onClick={() => onCreate(t)} style={{ color: t.color }}>
            <span>
              <HabitIcon name={t.icon} size={17} />
              <span style={{ color: 'var(--text)' }}>{t.name}</span>
            </span>
          </motion.button>
        ))}
      </div>
      <button className="btn primary block" onClick={() => onCreate()} style={{ marginTop: 6 }}>
        <Plus size={18} /> Своя привычка
      </button>
    </motion.div>
  )
}
