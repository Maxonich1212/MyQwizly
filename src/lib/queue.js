import { dirsFor } from './srs'
import { dayKey } from './day'

// Как в Anki: карточки на изучении, которые вернутся в ближайшие 20 минут, можно показать заранее
export const LEARN_AHEAD_MS = 20 * 60e3

// scope: { all: true } | { sectionId } | { deckId }
export function scopeDecks(decks, scope) {
  return Object.values(decks).filter(
    (d) => !d.deleted && (scope.all || (scope.deckId ? d.id === scope.deckId : d.section_id === scope.sectionId)),
  )
}

// Сколько новых карточек уже начато сегодня в каждой колоде
export function newSeenToday(reviews) {
  const today = dayKey()
  const out = {}
  for (const r of Object.values(reviews)) {
    if (r.day === today && r.state === 0) out[r.deck_id] = (out[r.deck_id] || 0) + 1
  }
  return out
}

export function buildQueue({ notes, decks, reviews, settings, scope, now = Date.now() }) {
  const deckList = scopeDecks(decks, scope)
  const deckById = Object.fromEntries(deckList.map((d) => [d.id, d]))
  const seen = newSeenToday(reviews)
  const today = dayKey(now)
  const due = []
  const later = []
  const fresh = {}

  for (const n of Object.values(notes)) {
    const deck = deckById[n.deck_id]
    if (!deck || n.deleted || n.suspended) continue
    for (const dir of dirsFor(deck)) {
      const c = n.srs?.[dir]
      if (c) {
        if (c.due <= now) due.push({ note: n.id, dir, due: c.due })
        else if (c.due <= now + LEARN_AHEAD_MS && c.state !== 2) later.push({ note: n.id, dir, due: c.due })
        continue
      }
      // Обратную сторону новой пары не показываем в тот же день, что и прямую
      if (dir === 'rev') {
        const f = n.srs?.fwd
        if (!f || dayKey(f.last_review || 0) === today) continue
      }
      ;(fresh[deck.id] ||= []).push({ note: n.id, dir, created: n.created_at, isNew: true })
      break
    }
  }

  const news = []
  for (const [deckId, list] of Object.entries(fresh)) {
    const left = Math.max(0, settings.newPerDay - (seen[deckId] || 0))
    list.sort((a, b) => a.created - b.created)
    news.push(...list.slice(0, left))
  }

  due.sort((a, b) => a.due - b.due)
  // Новые вкрапляем между повторениями, чтобы сессия не начиналась с горы незнакомого
  const queue = []
  let ni = 0
  for (let i = 0; i < due.length; i++) {
    queue.push(due[i])
    if (i % 3 === 2 && ni < news.length) queue.push(news[ni++])
  }
  while (ni < news.length) queue.push(news[ni++])
  later.sort((a, b) => a.due - b.due)
  return { queue, later, counts: { due: due.length, fresh: news.length } }
}

// Сводка «к повторению» по разделам/колодам для главного экрана
export function dueSummary(state, scope) {
  const { counts, later } = buildQueue({ ...state, scope })
  return { due: counts.due, fresh: counts.fresh, soon: later.length, total: counts.due + counts.fresh }
}
