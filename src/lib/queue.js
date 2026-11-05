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

export function buildQueue({ notes, decks, scope, now = Date.now() }) {
  const deckList = scopeDecks(decks, scope)
  const deckById = Object.fromEntries(deckList.map((d) => [d.id, d]))
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

  // Без дневного лимита новых: добавил карточки — сразу можно учить
  const news = []
  for (const list of Object.values(fresh)) {
    list.sort((a, b) => a.created - b.created)
    news.push(...list)
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

// «Погнали»: n случайных карточек из выбранного — в любом статусе, ответы засчитываются как обычно.
// ids — ограничить конкретными записями (например, «ошибки» из состава раздела)
export function randomQueue({ notes, decks }, scope, n, ids) {
  const deckById = Object.fromEntries(scopeDecks(decks, scope).map((d) => [d.id, d]))
  const only = ids ? new Set(ids) : null
  const items = []
  for (const note of Object.values(notes)) {
    const deck = deckById[note.deck_id]
    if (!deck || note.deleted || note.suspended || (only && !only.has(note.id))) continue
    // У слов направление выбираем случайно, чтобы одна пара не попадалась дважды подряд
    const dirs = dirsFor(deck)
    const dir = dirs[Math.floor(Math.random() * dirs.length)]
    items.push({ note: note.id, dir, isNew: !note.srs?.[dir] })
  }
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return { queue: items.slice(0, n), later: [] }
}

export function countInScope({ notes, decks }, scope) {
  const deckIds = new Set(scopeDecks(decks, scope).map((d) => d.id))
  let n = 0
  for (const note of Object.values(notes)) if (deckIds.has(note.deck_id) && !note.deleted && !note.suspended) n++
  return n
}
