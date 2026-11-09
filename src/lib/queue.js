import { dirsFor, noteStatus } from './srs'
import { stripHtml } from './check'

// scope: { all: true } | { sectionId } | { deckId }
export function scopeDecks(decks, scope) {
  return Object.values(decks).filter(
    (d) => !d.deleted && (scope.all || (scope.deckId ? d.id === scope.deckId : d.section_id === scope.sectionId)),
  )
}

// Артикли и одиночные буквы в словаре — не слова, учить там нечего («a», «an», «the»)
const NOT_WORDS = new Set(['a', 'an', 'the'])
export function isTrivial(note, deck) {
  if (deck?.kind !== 'vocab') return false
  const w = stripHtml(note.front || '').trim().toLowerCase()
  return NOT_WORDS.has(w) || (w.length <= 1 && w !== 'i')
}

// Карточка участвует в учёбе: не удалена, не убрана вручную и не мусорная
export function isActive(note, deck) {
  return !!deck && !deck.deleted && !note.deleted && !note.suspended && !isTrivial(note, deck)
}

// Последний ответ на каждую запись (в любом направлении)
export function lastByNote(reviews) {
  const last = {}
  for (const r of Object.values(reviews || {})) {
    const cur = last[r.note_id]
    if (!cur || r.reviewed_at > cur.at) last[r.note_id] = { rating: r.rating, at: r.reviewed_at, dir: r.dir }
  }
  return last
}

// Кучки как в Quizlet — по ПОСЛЕДНЕМУ ответу на запись, в каком бы направлении он ни был:
// «Знаю» в EN→RU значит, что слово выучено целиком, и RU→EN его тоже больше не спросят.
// 'off' — карточка убрана из учёбы
export function categoryOf(note, deck, last) {
  if (!isActive(note, deck)) return 'off'
  const l = last[note.id]
  // Оценки «Трудно» из прошлых версий (2) считаем как «не знаю»: уверенности не было
  if (l) return l.rating >= 3 ? 'known' : 'unknown'
  return noteStatus(note, deck).status === 'new' ? 'todo' : 'known'
}

export function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

// Направление для слова: где ошибся — то и спрашиваем, новое — случайное
function pickDir(deck, l) {
  const dirs = dirsFor(deck)
  if (l?.dir && dirs.includes(l.dir)) return l.dir
  return dirs[Math.floor(Math.random() * dirs.length)]
}

// «Повторить»: всё, что ещё не знаешь, — кучка «Не знаю» и непройденные. «Знаю» в план не попадает никогда.
// Порядок каждый раз новый и вперемешку по колодам; ошибки вкраплены между новыми (1 к 2),
// чтобы при большой колоде до них доходило в начале, а не через тысячу новых слов.
export function buildQueue({ notes, decks, reviews, scope }) {
  const deckById = Object.fromEntries(scopeDecks(decks, scope).map((d) => [d.id, d]))
  const last = lastByNote(reviews)
  const wrong = []
  const fresh = []
  for (const n of Object.values(notes)) {
    const deck = deckById[n.deck_id]
    if (!deck) continue
    const cat = categoryOf(n, deck, last)
    if (cat === 'unknown') wrong.push({ note: n.id, dir: pickDir(deck, last[n.id]) })
    else if (cat === 'todo') fresh.push({ note: n.id, dir: pickDir(deck), isNew: true })
  }
  shuffle(wrong)
  shuffle(fresh)
  const queue = []
  let w = 0
  let f = 0
  while (w < wrong.length || f < fresh.length) {
    if (w < wrong.length) queue.push(wrong[w++])
    for (let k = 0; k < 2 && f < fresh.length; k++) queue.push(fresh[f++])
  }
  return { queue, later: [], counts: { due: wrong.length, fresh: fresh.length } }
}

// Сводка «к повторению» по разделам/колодам для главного экрана
export function dueSummary(state, scope) {
  const { counts } = buildQueue({ ...state, scope })
  return { due: counts.due, fresh: counts.fresh, soon: 0, total: counts.due + counts.fresh }
}

// Что берёт «Погнали»: всё невыученное; если выучено всё — тогда уж всё подряд (прогнать выученное)
function goPool({ notes, decks, reviews }, scope, ids) {
  const deckById = Object.fromEntries(scopeDecks(decks, scope).map((d) => [d.id, d]))
  const last = lastByNote(reviews)
  const only = ids ? new Set(ids) : null
  const open = []
  const all = []
  for (const note of Object.values(notes)) {
    const deck = deckById[note.deck_id]
    if (!deck || (only && !only.has(note.id))) continue
    const cat = categoryOf(note, deck, last)
    if (cat === 'off') continue
    const item = { note: note.id, dir: pickDir(deck, cat === 'unknown' ? last[note.id] : null), isNew: cat === 'todo' }
    all.push(item)
    if (cat !== 'known') open.push(item)
  }
  // Явный список (кучка «Знаю» → «Повторить эти») — берём как есть
  return only || !open.length ? all : open
}

// «Погнали»: n случайных записей; у слов — одно направление на запись, второе не попадётся
export function randomQueue(state, scope, n, ids) {
  return { queue: shuffle(goPool(state, scope, ids)).slice(0, n), later: [] }
}

export function countInScope(state, scope) {
  return goPool(state, scope).length
}
