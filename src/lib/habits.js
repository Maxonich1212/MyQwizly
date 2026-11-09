import { useMemo } from 'react'
import { useStore, upsert, patch, getState } from './store'
import { addDays, dayKey, weekStart, parseKey } from './day'

export const HABIT_COLORS = [
  '#f2706b', '#f39a4c', '#f4c34a', '#f2d24b', '#b5e04e', '#6fd98a', '#5bd0a6',
  '#4fd1c5', '#5ccbe8', '#5ab1f5', '#6b9cf7', '#8487f5', '#a284f5', '#bf7ff2',
  '#df7cec', '#ec7bb8', '#ef7a8f', '#9aa6ba', '#a3a8b3', '#a8a8a8', '#b3aca2',
]

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const wd = (key) => (parseKey(key).getDay() + 6) % 7

export const logId = (habitId, day) => `${habitId}:${day}`

// Нужно ли выполнять привычку в этот день
export function isScheduled(h, day) {
  const r = h.repeat || { type: 'daily' }
  if (r.type === 'days') return (r.days || []).includes(wd(day))
  return true // daily и «N раз в неделю» — отметить можно в любой день
}

export function targetOf(h) {
  return h.tracking === 'check' ? 1 : Math.max(1, h.target || 1)
}

// Прогресс дня 0..1. Для «бросить привычку» лог = срыв, поэтому день без лога — успех
export function progressOf(h, log) {
  const v = log && !log.deleted ? log.value : 0
  if (h.kind === 'quit') return v > 0 ? 0 : 1
  return Math.min(1, v / targetOf(h))
}

export function useHabitLogs() {
  const logs = useStore((s) => s.habit_logs)
  return useMemo(() => {
    const by = {}
    for (const l of Object.values(logs)) {
      if (l.deleted) continue
      ;(by[l.habit_id] ||= {})[l.day] = l
    }
    return by
  }, [logs])
}

export function useHabits() {
  const habits = useStore((s) => s.habits)
  return useMemo(() => Object.values(habits).filter((h) => !h.deleted && !h.archived).sort((a, b) => a.sort - b.sort), [habits])
}

export function createdDay(h) {
  return dayKey(h.created_at)
}

// Серия: подряд выполненные дни по расписанию (для «N раз в неделю» — подряд выполненные недели)
export function habitStats(h, logs = {}) {
  const today = dayKey()
  const from = createdDay(h)
  const r = h.repeat || { type: 'daily' }
  const prog = (d) => progressOf(h, logs[d])

  if (r.type === 'weekly') {
    const times = r.times || 3
    const weeks = []
    for (let w = weekStart(from); w <= today; w = addDays(w, 7)) {
      let n = 0
      for (let i = 0; i < 7; i++) if (prog(addDays(w, i)) >= 1) n++
      weeks.push({ w, ok: n >= times, n })
    }
    let cur = 0
    let best = 0
    let run = 0
    weeks.forEach((x, i) => {
      if (x.ok) run++
      else if (i !== weeks.length - 1) run = 0
      best = Math.max(best, run)
    })
    cur = run
    const thisWeek = weeks[weeks.length - 1]?.n || 0
    return { current: cur, best, unit: 'week', total: countDone(h, logs), rate: rate30(h, logs), thisWeek, times, todayDone: prog(today) >= 1 }
  }

  let cur = 0
  let best = 0
  let run = 0
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (!isScheduled(h, d)) continue
    if (prog(d) >= 1) run++
    else if (d !== today) run = 0
    best = Math.max(best, run)
  }
  cur = run
  return { current: cur, best, unit: 'day', total: countDone(h, logs), rate: rate30(h, logs), todayDone: prog(today) >= 1 }
}

function countDone(h, logs) {
  if (h.kind === 'quit') {
    let n = 0
    for (let d = createdDay(h); d <= dayKey(); d = addDays(d, 1)) if (progressOf(h, logs[d]) >= 1) n++
    return n
  }
  return Object.values(logs).filter((l) => progressOf(h, l) >= 1).length
}

// Процент выполнения за последние 30 дней (или с момента создания)
function rate30(h, logs) {
  const today = dayKey()
  const from = createdDay(h) > addDays(today, -29) ? createdDay(h) : addDays(today, -29)
  let sched = 0
  let done = 0
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (!isScheduled(h, d)) continue
    const ok = progressOf(h, logs[d]) >= 1
    if (d === today && !ok) continue
    sched++
    if (ok) done++
  }
  if (h.repeat?.type === 'weekly') return sched ? Math.min(1, done / ((sched / 7) * (h.repeat.times || 3))) : 0
  return sched ? done / sched : 0
}

// Отметка дня: «да/нет» — переключение, «количество» — +1 по кругу, «измерение» — значение передаётся явно
export function tapHabit(h, day = dayKey(), value) {
  const id = logId(h.id, day)
  const cur = getState().habit_logs[id]
  const curVal = cur && !cur.deleted ? cur.value : 0
  let next
  if (value != null) next = value
  else if (h.kind === 'quit' || h.tracking === 'check') next = curVal > 0 ? 0 : 1
  else if (h.tracking === 'count') next = curVal >= targetOf(h) ? 0 : curVal + 1
  else next = curVal >= targetOf(h) ? 0 : targetOf(h)
  upsert('habit_logs', { id, habit_id: h.id, day, value: next, note: cur?.note ?? null, deleted: next <= 0 && !cur?.note })
  if (next > 0) backdate(h, day)
  navigator.vibrate?.(next > 0 ? 10 : 6)
  return next
}

// Отметил день раньше создания привычки (создал сегодня, а сделал ещё вчера) — привычка «начинается» с этого дня,
// иначе отметка сохранится, но календарь, серия и статистика её не покажут
export function backdate(h, day) {
  if (day >= createdDay(h)) return
  const d = parseKey(day)
  d.setHours(12, 0, 0, 0)
  patch('habits', h.id, { created_at: d.getTime() })
}

// Чинит привычки, у которых уже есть отметки раньше даты создания
export function healBackdated(habits, logs) {
  for (const h of habits) {
    const days = Object.keys(logs[h.id] || {}).filter((d) => logs[h.id][d].value > 0).sort()
    if (days[0] && days[0] < createdDay(h)) backdate(h, days[0])
  }
}

export function setNote(h, day, note) {
  const id = logId(h.id, day)
  const cur = getState().habit_logs[id]
  upsert('habit_logs', { id, habit_id: h.id, day, value: cur?.value || 0, note: note || null, deleted: !note && !(cur?.value > 0) })
}

export function repeatLabel(h) {
  const r = h.repeat || { type: 'daily' }
  if (r.type === 'days') return (r.days || []).map((i) => WEEKDAYS_SHORT[i]).join(', ') || 'Не выбрано'
  if (r.type === 'weekly') return `${r.times || 3} раза в неделю`
  return 'Каждый день'
}
