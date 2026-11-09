import { useMemo } from 'react'
import { useStore } from './store'
import { aggregate, globalStreak, sectionStreak } from './stats'
import { buildQueue, categoryOf, lastByNote } from './queue'
import { noteStatus } from './srs'
import { dayKey } from './day'

export function useDays() {
  const reviews = useStore((s) => s.reviews)
  return useMemo(() => aggregate(reviews), [reviews])
}

export function useStreak() {
  const days = useDays()
  const settings = useStore((s) => s.settings)
  return useMemo(() => globalStreak(days, settings), [days, settings])
}

export function useSectionStreaks() {
  const days = useDays()
  const settings = useStore((s) => s.settings)
  const sections = useStore((s) => s.sections)
  return useMemo(() => {
    const out = {}
    for (const s of Object.values(sections)) if (!s.deleted) out[s.id] = sectionStreak(days, settings, s)
    return out
  }, [days, settings, sections])
}

// Пересчитываем раз в минуту, чтобы «к повторению» обновлялось само
export function useQueueState() {
  const notes = useStore((s) => s.notes)
  const decks = useStore((s) => s.decks)
  const reviews = useStore((s) => s.reviews)
  const settings = useStore((s) => s.settings)
  return { notes, decks, reviews, settings }
}

export function useDue(scope) {
  const st = useQueueState()
  const key = JSON.stringify(scope)
  return useMemo(() => {
    const { counts, later } = buildQueue({ ...st, scope })
    return { due: counts.due, fresh: counts.fresh, soon: later.length, total: counts.due + counts.fresh }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.notes, st.decks, st.reviews, st.settings, key])
}

// Последний ответ на каждую запись — по нему видно, ошибка это или пройдено
export function useLastRatings() {
  const reviews = useStore((s) => s.reviews)
  return useMemo(() => lastByNote(reviews), [reviews])
}

export { categoryOf }

export const CATEGORIES = [
  { k: 'unknown', label: 'Не знаю', color: 'var(--again)' },
  { k: 'known', label: 'Знаю', color: 'var(--good)' },
  { k: 'todo', label: 'Не пройдено', color: 'color-mix(in srgb, var(--text) 30%, transparent)' },
]

export function useComposition(deckIds) {
  const notes = useStore((s) => s.notes)
  const decks = useStore((s) => s.decks)
  const last = useLastRatings()
  const key = deckIds.join(',')
  return useMemo(() => {
    const set = new Set(deckIds)
    const out = { total: 0, todo: 0, unknown: 0, known: 0, off: 0, mature: 0, ids: { todo: [], unknown: [], known: [], off: [] } }
    for (const n of Object.values(notes)) {
      if (n.deleted || !set.has(n.deck_id)) continue
      const deck = decks[n.deck_id]
      const c = categoryOf(n, deck, last)
      if (c === 'off') {
        out.off++
        out.ids.off.push(n.id)
        continue
      }
      out.total++
      out[c]++
      out.ids[c].push(n.id)
      if (noteStatus(n, deck).mature) out.mature++
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, decks, last, key])
}

export function useToday() {
  const days = useDays()
  return days[dayKey()] || { n: 0, ms: 0, correct: 0, fresh: 0, sections: {} }
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}
