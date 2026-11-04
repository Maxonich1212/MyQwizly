import { addDays, dayKey, weekStart, diffDays } from './day'

// Агрегаты по дням: всего, время, верные (оценка ≥ «Трудно»), по разделам
export function aggregate(reviews) {
  const days = {}
  for (const r of Object.values(reviews)) {
    const d = (days[r.day] ||= { n: 0, ms: 0, correct: 0, fresh: 0, sections: {} })
    d.n++
    d.ms += Math.min(r.ms || 0, 120_000) // залипшую на экране карточку не считаем часами учёбы
    if (r.rating > 1) d.correct++
    if (r.state === 0) d.fresh++
    d.sections[r.section_id] = (d.sections[r.section_id] || 0) + 1
  }
  return days
}

export function goalFor(settings, day) {
  let g = settings.dailyGoal
  const hist = settings.goalHistory || []
  for (const h of hist) if (h.from <= day) g = h.goal
  return g
}

// Стрик с «заморозками»: пропущенный день съедает заморозку недели, если она осталась.
// Считаем детерминированно по истории, поэтому на всех устройствах результат одинаковый.
export function streak(countOf, goalOf, freezesPerWeek, firstDay) {
  const today = dayKey()
  const res = { current: 0, best: 0, frozen: new Set(), met: new Set(), todayDone: false }
  if (!firstDay) return res
  let cur = 0
  const used = {}
  for (let d = firstDay; d <= today; d = addDays(d, 1)) {
    const ok = countOf(d) >= goalOf(d)
    if (ok) {
      res.met.add(d)
      cur++
    } else if (d === today) {
      // сегодняшний день ещё не прожит — стрик не рвём
    } else if (cur > 0 && (used[weekStart(d)] || 0) < freezesPerWeek) {
      used[weekStart(d)] = (used[weekStart(d)] || 0) + 1
      res.frozen.add(d)
    } else {
      cur = 0
    }
    res.best = Math.max(res.best, cur)
  }
  res.current = cur
  res.todayDone = res.met.has(today)
  res.freezesLeft = Math.max(0, freezesPerWeek - (used[weekStart(today)] || 0))
  return res
}

function firstDayOf(days) {
  const keys = Object.keys(days)
  return keys.length ? keys.reduce((a, b) => (a < b ? a : b)) : null
}

export function globalStreak(days, settings) {
  return streak((d) => days[d]?.n || 0, (d) => goalFor(settings, d), settings.freezesPerWeek, firstDayOf(days))
}

export function sectionStreak(days, settings, section) {
  const goal = section.goal || settings.sectionGoal
  const own = Object.fromEntries(Object.entries(days).filter(([, v]) => v.sections[section.id]))
  return streak((d) => days[d]?.sections[section.id] || 0, () => goal, settings.freezesPerWeek, firstDayOf(own))
}

// Сумма за период [from, to] включительно
export function sumRange(days, from, to) {
  const out = { n: 0, ms: 0, correct: 0, fresh: 0, active: 0 }
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const v = days[d]
    if (!v) continue
    out.n += v.n
    out.ms += v.ms
    out.correct += v.correct
    out.fresh += v.fresh
    out.active++
  }
  return out
}

export function pctChange(cur, prev) {
  if (!prev) return cur ? null : 0
  return Math.round(((cur - prev) / prev) * 100)
}

// Прогноз: сколько карточек станет к повторению в каждый из следующих N дней
export function forecast(notes, decks, n = 14) {
  const today = dayKey()
  const out = Array.from({ length: n }, (_, i) => ({ day: addDays(today, i), n: 0 }))
  for (const note of Object.values(notes)) {
    if (note.deleted || note.suspended || decks[note.deck_id]?.deleted) continue
    for (const c of Object.values(note.srs || {})) {
      const i = Math.max(0, diffDays(dayKey(c.due), today))
      if (i < n) out[i].n++
    }
  }
  return out
}
