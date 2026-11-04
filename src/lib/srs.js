import { fsrs, generatorParameters, createEmptyCard, Rating, State } from 'ts-fsrs'

export { Rating, State }

let scheduler = null
let schedulerRetention = null

function getScheduler(retention = 0.9) {
  if (!scheduler || schedulerRetention !== retention) {
    scheduler = fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true, enable_short_term: true }))
    schedulerRetention = retention
  }
  return scheduler
}

// Слова учим в обе стороны (EN→RU и RU→EN), вопросы — в одну
export const dirsFor = (deck) => (deck?.kind === 'vocab' ? ['fwd', 'rev'] : ['fwd'])

export function cardOf(note, dir) {
  const s = note.srs?.[dir]
  if (!s) return null
  return { ...s, due: new Date(s.due), last_review: s.last_review ? new Date(s.last_review) : undefined }
}

function serialize(c) {
  return {
    due: +c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? +c.last_review : null,
  }
}

// Через сколько карточка вернётся при каждой оценке — для подписей под кнопками
export function previewIntervals(note, dir, retention, now = new Date()) {
  const f = getScheduler(retention)
  const card = cardOf(note, dir) || createEmptyCard(now)
  const out = {}
  for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
    out[r] = +f.next(card, now, r).card.due - +now
  }
  return out
}

export function gradeNote(note, dir, rating, retention, now = new Date()) {
  const f = getScheduler(retention)
  const card = cardOf(note, dir) || createEmptyCard(now)
  const next = f.next(card, now, rating).card
  return { srs: { ...note.srs, [dir]: serialize(next) }, prevState: card.state, due: +next.due }
}

export function fmtInterval(ms) {
  const m = ms / 60000
  if (m < 1) return '<1 мин'
  if (m < 60) return `${Math.round(m)} мин`
  const h = m / 60
  if (h < 24) return `${Math.round(h)} ч`
  const d = h / 24
  if (d < 30) return `${Math.round(d)} д`
  const mo = d / 30.4
  if (mo < 12) return `${mo < 10 ? mo.toFixed(1).replace('.0', '') : Math.round(mo)} мес`
  return `${(d / 365).toFixed(1).replace('.0', '')} г`
}

// Статус карточки для списков и прогресса
export function noteStatus(note, deck) {
  const dirs = dirsFor(deck)
  let best = 'new'
  let minDue = Infinity
  let mature = true
  let any = false
  for (const d of dirs) {
    const c = note.srs?.[d]
    if (!c) {
      mature = false
      continue
    }
    any = true
    minDue = Math.min(minDue, c.due)
    if (c.state === State.Learning || c.state === State.Relearning) best = 'learning'
    else if (best !== 'learning') best = 'review'
    if (c.stability < 21) mature = false
  }
  if (!any) return { status: 'new', due: null, mature: false }
  return { status: mature ? 'mature' : best, due: minDue, mature }
}
