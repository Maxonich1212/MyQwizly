// Общий результат любого импортёра:
// { groups: [{ path: ['Раздел', 'Колода'], kind?, cards: [{ front, back, extra, format, tags }] }], media: [{ name, blob }] }

export function splitPath(s) {
  if (!s) return []
  return String(s)
    .split(/::|\u001f|\s+\/\s+|>/)
    .map((p) => p.trim())
    .filter(Boolean)
}

const looksCode = (s) => /```|\bfunc\b|\bclass\b|\bvar\b|\blet\b.*=|[{};]\s*$/m.test(s)
const words = (s) => s.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length

// Слово/фраза с переводом → «vocab», всё остальное → вопрос-ответ
export function detectKind(cards) {
  if (!cards.length) return 'qa'
  // Явная подсказка из названий полей (question/answer или word/translation) важнее эвристики
  const hinted = cards.filter((c) => c.hint)
  if (hinted.length > cards.length / 2) {
    const v = hinted.filter((c) => c.hint === 'vocab').length
    return v > hinted.length / 2 ? 'vocab' : 'qa'
  }
  let vocab = 0
  for (const c of cards) {
    const f = c.front.replace(/<[^>]+>/g, '').trim()
    const b = c.back.replace(/<[^>]+>/g, '').trim()
    if (words(f) <= 5 && f.length <= 50 && b.length <= 50 && !f.endsWith('?') && !looksCode(f + b)) vocab++
  }
  return vocab / cards.length >= 0.7 ? 'vocab' : 'qa'
}

export function finalize(groupsMap, media = []) {
  const groups = [...groupsMap.values()]
    .filter((g) => g.cards.length)
    .map((g) => ({ ...g, kind: g.kind || detectKind(g.cards) }))
  for (const g of groups) for (const c of g.cards) delete c.hint
  return { groups, media, total: groups.reduce((s, g) => s + g.cards.length, 0) }
}

export function addCard(groupsMap, path, card, kind) {
  const key = path.join('\u0001')
  if (!groupsMap.has(key)) groupsMap.set(key, { path, cards: [], kind })
  groupsMap.get(key).cards.push(card)
}
