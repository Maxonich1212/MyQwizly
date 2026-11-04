import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil } from 'lucide-react'
import { upsert, patch, uid, getState } from '../lib/store'
import { HABIT_COLORS, WEEKDAYS_SHORT, targetOf, tapHabit } from '../lib/habits'
import { dayKey, fmtDay } from '../lib/day'
import HabitIcon, { HABIT_ICONS } from './HabitIcon'
import { Sheet, Segmented, Stepper } from './ui'
import { liquid } from './fluid'

const BLANK = { name: '', description: '', icon: 'activity', color: HABIT_COLORS[0], kind: 'build', repeat: { type: 'daily', days: [0, 1, 2, 3, 4], times: 3 }, tracking: 'check', target: 1, unit: '', category: '' }

export function HabitEditor({ open, habit, preset, onClose, categories = [] }) {
  const [f, setF] = useState(BLANK)
  const [icons, setIcons] = useState(false)
  useEffect(() => {
    if (!open) return
    const src = habit || { ...BLANK, ...(preset || {}) }
    setF({ ...BLANK, ...src, repeat: { ...BLANK.repeat, ...(src.repeat || {}) }, description: src.description || '', unit: src.unit || '', category: src.category || '' })
    setIcons(false)
  }, [open, habit, preset])

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const setRepeat = (r) => setF((x) => ({ ...x, repeat: { ...x.repeat, ...r } }))
  const toggleDay = (i) => setRepeat({ days: f.repeat.days.includes(i) ? f.repeat.days.filter((d) => d !== i) : [...f.repeat.days, i].sort() })

  function save() {
    if (!f.name.trim()) return
    const data = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      icon: f.icon,
      color: f.color,
      kind: f.kind,
      repeat: f.repeat.type === 'days' ? { type: 'days', days: f.repeat.days } : f.repeat.type === 'weekly' ? { type: 'weekly', times: f.repeat.times } : { type: 'daily' },
      tracking: f.kind === 'quit' ? 'check' : f.tracking,
      target: f.tracking === 'check' ? 1 : f.target,
      unit: f.unit.trim() || null,
      category: f.category.trim() || null,
    }
    if (habit) patch('habits', habit.id, data)
    else upsert('habits', { id: uid(), ...data, reminder: null, sort: Date.now(), archived: false, deleted: false, created_at: Date.now() })
    onClose()
  }

  const c = f.color
  return (
    <Sheet open={open} onClose={onClose} title={habit ? 'Привычка' : 'Новая привычка'}>
      <div style={{ '--c': c }}>
        <div style={{ position: 'relative', textAlign: 'center', marginBottom: 18 }}>
          <motion.button
            onClick={() => setIcons(!icons)}
            whileTap={{ scale: 0.92 }}
            animate={{ backgroundColor: `color-mix(in srgb, ${c} 20%, transparent)` }}
            transition={liquid}
            style={{ width: 104, height: 104, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', color: c, position: 'relative' }}
          >
            <motion.span key={f.icon} initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={liquid}>
              <HabitIcon name={f.icon} size={46} strokeWidth={1.8} />
            </motion.span>
            <span style={{ position: 'absolute', right: 2, bottom: 6, width: 30, height: 30, borderRadius: '50%', background: c, color: '#fff', display: 'grid', placeItems: 'center', border: '3px solid var(--surface)' }}>
              <Pencil size={13} />
            </span>
          </motion.button>
          <div style={{ color: c, fontWeight: 650, marginTop: 6, fontSize: 15 }}>{icons ? 'Выбери иконку' : 'Сменить иконку'}</div>
        </div>
        <AnimatePresence initial={false}>
          {icons && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={liquid} style={{ overflow: 'hidden' }}>
              <div className="icon-grid" style={{ marginBottom: 18 }}>
                {Object.keys(HABIT_ICONS).map((k) => (
                  <button key={k} className={f.icon === k ? 'on' : ''} onClick={() => setF((x) => ({ ...x, icon: k }))}>
                    <HabitIcon name={k} size={20} />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <label className="field">
          <span className="mono-label">Название</span>
          <input className="input" value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="Например, LeetCode" />
        </label>
        <label className="field">
          <span className="mono-label">Описание</span>
          <input className="input" value={f.description} onChange={(e) => set('description')(e.target.value)} placeholder="Одна задача в день" />
        </label>

        <div className="field">
          <span className="mono-label">Цвет</span>
          <div className="palette">
            {HABIT_COLORS.map((col) => (
              <motion.button key={col} whileTap={{ scale: 0.85 }} className={c === col ? 'on' : ''} style={{ background: col, color: col }} onClick={() => set('color')(col)} aria-label={col} />
            ))}
          </div>
        </div>

        <div className="field">
          <span className="mono-label">Тип</span>
          <Segmented
            full
            value={f.kind}
            onChange={set('kind')}
            options={[
              { value: 'build', label: 'Выработать' },
              { value: 'quit', label: 'Бросить' },
            ]}
          />
          <div className="small faint" style={{ textAlign: 'center' }}>
            {f.kind === 'build' ? 'Отмечай каждый день, когда сделал.' : 'Отмечай только срывы — чистые дни считаются сами.'}
          </div>
        </div>

        <div className="field">
          <span className="mono-label">Повтор</span>
          <Segmented
            full
            value={f.repeat.type}
            onChange={(type) => setRepeat({ type })}
            options={[
              { value: 'daily', label: 'Каждый день' },
              { value: 'days', label: 'По дням' },
              { value: 'weekly', label: 'N в неделю' },
            ]}
          />
          <AnimatePresence initial={false} mode="wait">
            {f.repeat.type === 'days' && (
              <motion.div key="d" className="weekday-pills" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={liquid}>
                {WEEKDAYS_SHORT.map((w, i) => (
                  <motion.button key={w} whileTap={{ scale: 0.88 }} className={f.repeat.days.includes(i) ? 'on' : ''} onClick={() => toggleDay(i)}>
                    {w}
                  </motion.button>
                ))}
              </motion.div>
            )}
            {f.repeat.type === 'weekly' && (
              <motion.div key="w" className="row" style={{ marginTop: 10, justifyContent: 'center' }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={liquid}>
                <Stepper value={f.repeat.times} onChange={(times) => setRepeat({ times })} min={1} max={7} />
                <span className="muted">раз в неделю</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {f.kind === 'build' && (
          <div className="field">
            <span className="mono-label">Отслеживание</span>
            <Segmented
              full
              value={f.tracking}
              onChange={set('tracking')}
              options={[
                { value: 'check', label: 'Да / Нет' },
                { value: 'count', label: 'Количество' },
                { value: 'measure', label: 'Значение' },
              ]}
            />
            <AnimatePresence initial={false} mode="wait">
              {f.tracking === 'check' ? (
                <motion.div key="c" className="small faint" style={{ textAlign: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Просто отмечаешь: сделал или нет
                </motion.div>
              ) : (
                <motion.div key="t" className="row" style={{ marginTop: 6 }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={liquid}>
                  <span className="muted small">Цель в день</span>
                  {f.tracking === 'count' ? (
                    <Stepper value={f.target} onChange={set('target')} min={1} max={500} />
                  ) : (
                    <input className="input" type="number" inputMode="decimal" min="0" value={f.target} onChange={(e) => set('target')(Number(e.target.value) || 1)} style={{ width: 96 }} />
                  )}
                  <input className="input" value={f.unit} onChange={(e) => set('unit')(e.target.value)} placeholder={f.tracking === 'count' ? 'раз' : 'мин, км…'} style={{ flex: 1 }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="field">
          <span className="mono-label">Категория</span>
          <input className="input" value={f.category} onChange={(e) => set('category')(e.target.value)} placeholder="Учёба, Утро, Здоровье…" />
          {categories.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {categories.map((cat) => (
                <button key={cat} className={`chip ${f.category === cat ? 'accent' : ''}`} onClick={() => set('category')(cat)}>
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sheet-save">
          <motion.button className="btn block" style={{ background: c, color: '#fff', boxShadow: `0 10px 26px -10px ${c}` }} whileTap={{ scale: 0.97 }} onClick={save} disabled={!f.name.trim()}>
            Сохранить
          </motion.button>
        </div>
      </div>
    </Sheet>
  )
}

// Ввод значения для привычек «Значение» (минуты, км…)
export function ValueSheet({ target, logs, onClose }) {
  const [v, setV] = useState('')
  useEffect(() => {
    if (!target) return
    const cur = logs[target.h.id]?.[target.day]?.value
    setV(cur ? String(cur) : '')
  }, [target, logs])
  if (!target) return <Sheet open={false} onClose={onClose} />
  const { h, day } = target
  const save = () => {
    tapHabit(getState().habits[h.id], day, Number(String(v).replace(',', '.')) || 0)
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={h.name}>
      <div className="small faint" style={{ marginTop: -10, marginBottom: 14 }}>
        {day === dayKey() ? 'Сегодня' : fmtDay(day)} · цель {targetOf(h)} {h.unit || ''}
      </div>
      <div className="row">
        <input className="input" autoFocus type="number" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} style={{ fontSize: 22, fontWeight: 700 }} />
        <span className="muted">{h.unit}</span>
      </div>
      <button className="btn block" style={{ background: h.color, color: '#fff', marginTop: 16 }} onClick={save}>
        Сохранить
      </button>
    </Sheet>
  )
}
