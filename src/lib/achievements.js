import { useMemo } from 'react'
import { useStore } from './store'
import { useDays, useStreak } from './hooks'
import { useHabits, useHabitLogs, habitStats, isScheduled, progressOf, createdDay } from './habits'
import { addDays, dayKey } from './day'
import { noteStatus } from './srs'

// Достижения считаются из данных — ничего отдельно не хранится, кроме списка уже показанных
const DEFS = [
  { id: 'first', title: 'Первый шаг', desc: 'Повтори первую карточку', icon: 'Footprints', color: '#5ab1f5', of: (c) => [c.reviews, 1] },
  { id: 'r100', title: 'Сотня', desc: '100 повторений', icon: 'Layers', color: '#8487f5', of: (c) => [c.reviews, 100] },
  { id: 'r1000', title: 'Тысячник', desc: '1 000 повторений', icon: 'Rocket', color: '#a284f5', of: (c) => [c.reviews, 1000] },
  { id: 'r5000', title: 'Машина', desc: '5 000 повторений', icon: 'Zap', color: '#df7cec', of: (c) => [c.reviews, 5000] },
  { id: 's3', title: 'Разгон', desc: 'Стрик карточек 3 дня', icon: 'Flame', color: '#f39a4c', of: (c) => [c.streak, 3] },
  { id: 's7', title: 'Неделя огня', desc: 'Стрик карточек 7 дней', icon: 'Flame', color: '#f2706b', of: (c) => [c.streak, 7] },
  { id: 's30', title: 'Месяц без пропусков', desc: 'Стрик карточек 30 дней', icon: 'Crown', color: '#f4c34a', of: (c) => [c.streak, 30] },
  { id: 's100', title: 'Легенда', desc: 'Стрик карточек 100 дней', icon: 'Trophy', color: '#f4c34a', of: (c) => [c.streak, 100] },
  { id: 'm50', title: 'Крепкая память', desc: '50 выученных карточек', icon: 'Brain', color: '#6fd98a', of: (c) => [c.mature, 50] },
  { id: 'm250', title: 'Энциклопедия', desc: '250 выученных карточек', icon: 'BookMarked', color: '#5bd0a6', of: (c) => [c.mature, 250] },
  { id: 'vocab500', title: 'Полиглот', desc: '500 повторений слов', icon: 'Languages', color: '#5ccbe8', of: (c) => [c.vocab, 500] },
  { id: 'qa300', title: 'Готов к собесу', desc: '300 ответов на вопросы', icon: 'Briefcase', color: '#6b9cf7', of: (c) => [c.qa, 300] },
  { id: 'early', title: 'Жаворонок', desc: '50 карточек до 8 утра', icon: 'Sunrise', color: '#f4c34a', of: (c) => [c.early, 50] },
  { id: 'owl', title: 'Сова', desc: '50 карточек после 23:00', icon: 'Moon', color: '#8487f5', of: (c) => [c.owl, 50] },
  { id: 'h1', title: 'Новая привычка', desc: 'Создай первую привычку', icon: 'Sparkles', color: '#ec7bb8', of: (c) => [c.habits, 1] },
  { id: 'h7', title: 'Семь дней', desc: 'Серия привычки 7 дней', icon: 'CalendarCheck', color: '#b5e04e', of: (c) => [c.habitBest, 7] },
  { id: 'h30', title: 'Это уже я', desc: 'Серия привычки 30 дней', icon: 'Medal', color: '#6fd98a', of: (c) => [c.habitBest, 30] },
  { id: 'h100', title: 'Железная воля', desc: 'Серия привычки 100 дней', icon: 'Mountain', color: '#9aa6ba', of: (c) => [c.habitBest, 100] },
  { id: 'pd1', title: 'Идеальный день', desc: 'Все привычки дня выполнены', icon: 'Star', color: '#f4c34a', of: (c) => [c.perfectDays, 1] },
  { id: 'pw', title: 'Идеальная неделя', desc: '7 идеальных дней подряд', icon: 'Award', color: '#f39a4c', of: (c) => [c.perfectRun, 7] },
  { id: 'hd100', title: 'Сотня отметок', desc: '100 выполнений привычек', icon: 'Target', color: '#ef7a8f', of: (c) => [c.habitDone, 100] },
]

export function useAchievements() {
  const reviews = useStore((s) => s.reviews)
  const notes = useStore((s) => s.notes)
  const decks = useStore((s) => s.decks)
  const days = useDays()
  const streak = useStreak()
  const habits = useHabits()
  const logs = useHabitLogs()

  return useMemo(() => {
    const c = { reviews: 0, vocab: 0, qa: 0, early: 0, owl: 0, streak: streak.best, mature: 0, habits: habits.length, habitBest: 0, habitDone: 0, perfectDays: 0, perfectRun: 0 }
    for (const r of Object.values(reviews)) {
      c.reviews++
      if (decks[r.deck_id]?.kind === 'vocab') c.vocab++
      else c.qa++
      const h = new Date(r.reviewed_at).getHours()
      if (h >= 4 && h < 8) c.early++
      if (h >= 23 || h < 4) c.owl++
    }
    for (const n of Object.values(notes)) if (!n.deleted && decks[n.deck_id] && noteStatus(n, decks[n.deck_id]).mature) c.mature++
    for (const h of habits) {
      const st = habitStats(h, logs[h.id] || {})
      if (st.unit === 'day') c.habitBest = Math.max(c.habitBest, st.best)
      c.habitDone += st.total
    }
    // Идеальные дни: все привычки, запланированные на день, выполнены
    if (habits.length) {
      const first = habits.map(createdDay).sort()[0]
      let run = 0
      for (let d = first; d <= dayKey(); d = addDays(d, 1)) {
        const due = habits.filter((h) => createdDay(h) <= d && isScheduled(h, d) && h.repeat?.type !== 'weekly')
        const ok = due.length > 0 && due.every((h) => progressOf(h, logs[h.id]?.[d]) >= 1)
        if (ok) {
          c.perfectDays++
          run++
          c.perfectRun = Math.max(c.perfectRun, run)
        } else if (d !== dayKey()) run = 0
      }
    }
    return DEFS.map((d) => {
      const [cur, target] = d.of(c)
      return { ...d, cur: Math.min(cur, target), target, unlocked: cur >= target }
    })
  }, [reviews, notes, decks, days, streak.best, habits, logs]) // eslint-disable-line
}
