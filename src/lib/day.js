// День начинается ровно в 00:00 — как и ожидаешь, глядя на часы
// (раньше был сдвиг на 4:00 «как в Anki», из-за него ночные отметки попадали во вчера)
const ROLLOVER_H = 0
const pad = (n) => String(n).padStart(2, '0')

export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function dayKey(ts = Date.now()) {
  return toKey(new Date(ts - ROLLOVER_H * 3600e3))
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(key, n) {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export function diffDays(a, b) {
  return Math.round((parseKey(a) - parseKey(b)) / 864e5)
}

// Понедельник недели, в которую входит день
export function weekStart(key) {
  const d = parseKey(key)
  const wd = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - wd)
  return toKey(d)
}

export function monthKey(key) {
  return key.slice(0, 7)
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function fmtDay(key) {
  const d = parseKey(key)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
export const monthName = (m) => MONTHS_NOM[m]
export const monthShort = (m) => MONTHS_SHORT[m]

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

export function fmtMinutes(ms) {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  return `${h} ч ${m % 60} мин`
}
