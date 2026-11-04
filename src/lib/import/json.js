import { addCard, finalize, splitPath } from './common'

// Понимает JSON почти любой формы: массив карточек, { колода: [...] }, вложенные разделы,
// словарь { "apple": "яблоко" }, пары [front, back]. Поля ищем по распространённым названиям.

const FRONT = ['front', 'question', 'q', 'term', 'word', 'en', 'english', 'prompt', 'title', 'вопрос', 'слово', 'термин']
const BACK = ['back', 'answer', 'a', 'definition', 'translation', 'ru', 'russian', 'meaning', 'explanation', 'ответ', 'перевод', 'значение']
const EXAMPLE = ['example', 'examples', 'sentence', 'usage', 'пример', 'примеры']
const TRANSCRIPTION = ['transcription', 'ipa', 'pronunciation', 'phonetic', 'транскрипция']
const HINT = ['hint', 'note', 'notes', 'comment', 'подсказка', 'заметка']
const GROUP = ['deck', 'section', 'category', 'topic', 'group', 'subject', 'колода', 'раздел', 'тема', 'категория']
const CHILDREN = ['cards', 'items', 'questions', 'words', 'notes', 'entries', 'data', 'карточки', 'вопросы', 'слова']
const NESTED = ['sections', 'decks', 'children', 'groups', 'topics', 'categories', 'разделы', 'колоды']
const NAME = ['name', 'title', 'deck', 'section', 'topic', 'название']

const QA_KEYS = new Set(['question', 'q', 'prompt', 'вопрос', 'answer', 'a', 'explanation', 'ответ'])
const VOCAB_KEYS = new Set(['word', 'en', 'english', 'слово', 'translation', 'ru', 'russian', 'перевод'])

const lowerKeys = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]))
const pick = (o, keys) => {
  for (const k of keys) if (o[k] != null && o[k] !== '') return o[k]
  return undefined
}
const asText = (v) => (Array.isArray(v) ? v.join('\n') : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

function toCard(item) {
  if (Array.isArray(item) && item.length >= 2 && item.every((x) => typeof x === 'string')) {
    return { card: { front: item[0], back: item[1], extra: {}, format: 'md', tags: [] }, group: [] }
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const o = lowerKeys(item)
  const front = pick(o, FRONT)
  const back = pick(o, BACK)
  if (front == null || back == null || typeof front === 'object' && !Array.isArray(front)) return null
  const extra = {}
  const ex = pick(o, EXAMPLE)
  const tr = pick(o, TRANSCRIPTION)
  const hint = pick(o, HINT)
  if (ex) extra.example = asText(ex)
  if (tr) extra.transcription = asText(tr)
  if (hint && typeof hint !== 'object') extra.hint = asText(hint)
  const tags = Array.isArray(o.tags) ? o.tags.map(String) : typeof o.tags === 'string' ? o.tags.split(/[\s,]+/).filter(Boolean) : []
  const fmt = /<\/?(div|br|b|i|p|span|img)\b/i.test(asText(front) + asText(back)) ? 'html' : 'md'
  // Вложенная группа у самой карточки: "deck": "iOS::Swift" или "section" + "deck"
  const group = []
  if (typeof o.section === 'string' && typeof o.deck === 'string') group.push(...splitPath(o.section), ...splitPath(o.deck))
  else {
    const g = pick(o, GROUP)
    if (typeof g === 'string') group.push(...splitPath(g))
  }
  const fk = FRONT.find((k) => o[k] != null && o[k] !== '')
  const bk = BACK.find((k) => o[k] != null && o[k] !== '')
  const kindHint = QA_KEYS.has(fk) || QA_KEYS.has(bk) ? 'qa' : VOCAB_KEYS.has(fk) || VOCAB_KEYS.has(bk) ? 'vocab' : undefined
  return { card: { front: asText(front).trim(), back: asText(back).trim(), extra, format: fmt, tags, hint: kindHint }, group }
}

function walk(value, path, groups) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const c = toCard(item)
      if (c) addCard(groups, [...path, ...c.group], c.card)
      else if (item && typeof item === 'object') walk(item, path, groups)
    }
    return
  }
  if (!value || typeof value !== 'object') return
  const o = lowerKeys(value)
  const childKey = CHILDREN.find((k) => Array.isArray(o[k]))
  const nestedKey = NESTED.find((k) => Array.isArray(o[k]) || (o[k] && typeof o[k] === 'object'))
  const name = pick(o, NAME)
  const here = typeof name === 'string' && (childKey || nestedKey) ? [...path, ...splitPath(name)] : path
  if (childKey || nestedKey) {
    if (childKey) walk(o[childKey], here, groups)
    if (nestedKey) walk(o[nestedKey], here, groups)
    return
  }
  const single = toCard(value)
  if (single) {
    addCard(groups, [...path, ...single.group], single.card)
    return
  }
  const entries = Object.entries(value)
  // Словарь «слово → перевод»
  if (entries.length && entries.every(([, v]) => typeof v === 'string')) {
    for (const [k, v] of entries) addCard(groups, path, { front: k, back: v, extra: {}, format: 'md', tags: [] })
    return
  }
  for (const [k, v] of entries) if (v && typeof v === 'object') walk(v, [...path, ...splitPath(k)], groups)
}

export function parseJson(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    // JSON Lines: по объекту на строку
    data = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  }
  const groups = new Map()
  walk(data, [], groups)
  return finalize(groups)
}
