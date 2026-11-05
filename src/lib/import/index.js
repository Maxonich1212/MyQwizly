import { getState, upsertRows, uid, askSyncDecision } from '../store'
import { saveMedia } from '../media'
import { PALETTE, pickEmoji } from '../palette'
import { plural } from '../day'

export async function parseFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.apkg') || name.endsWith('.colpkg')) {
    const { parseApkg } = await import('./apkg')
    return parseApkg(file)
  }
  if (name.endsWith('.json') || name.endsWith('.jsonl') || name.endsWith('.txt')) {
    const { parseJson } = await import('./json')
    return parseJson(await file.text())
  }
  throw new Error('Поддерживаются файлы .apkg и .json')
}

const norm = (s) => s.trim().toLowerCase()

// Раскладка по разделам/колодам.
// target = 'auto' → первый уровень пути = раздел, остальное = колода;
// target = id раздела или { newName } → всё в один раздел, колода = полный путь.
export function planImport(parsed, target, fallbackName) {
  const { sections, decks } = getState()
  const liveSections = Object.values(sections).filter((s) => !s.deleted)
  const liveDecks = Object.values(decks).filter((d) => !d.deleted)
  return parsed.groups.map((g) => {
    let sectionName
    let deckName
    if (target === 'auto') {
      if (g.path.length >= 2) {
        sectionName = g.path[0]
        deckName = g.path.slice(1).join(' · ')
      } else {
        sectionName = fallbackName
        deckName = g.path[0] || fallbackName
      }
    } else {
      sectionName = target.newName || sections[target]?.name
      deckName = g.path.join(' · ') || fallbackName
    }
    const sec = typeof target === 'string' && target !== 'auto' ? sections[target] : liveSections.find((s) => norm(s.name) === norm(sectionName))
    const deck = sec && liveDecks.find((d) => d.section_id === sec.id && norm(d.name) === norm(deckName))
    return { group: g, sectionName, deckName, sectionId: sec?.id, deckId: deck?.id, kind: deck?.kind || g.kind }
  })
}

export async function commitImport(parsed, plan) {
  const { sections, notes } = getState()
  const newSections = []
  const newDecks = []
  const newNotes = []
  const secByName = {}
  const deckByKey = {}
  let skipped = 0
  let order = Object.keys(sections).length
  const now = Date.now()

  for (const p of plan) {
    let sectionId = p.sectionId || secByName[norm(p.sectionName)]
    if (!sectionId) {
      const color = PALETTE[order % PALETTE.length].id
      const s = { id: uid(), name: p.sectionName, emoji: p.emoji || pickEmoji(p.sectionName), color, sort: order++, deleted: false, goal: null }
      newSections.push(s)
      sectionId = secByName[norm(p.sectionName)] = s.id
    }
    const dk = sectionId + '|' + norm(p.deckName)
    let deckId = p.deckId || deckByKey[dk]
    if (!deckId) {
      const d = { id: uid(), section_id: sectionId, name: p.deckName, kind: p.kind, sort: now + newDecks.length, deleted: false }
      newDecks.push(d)
      deckId = deckByKey[dk] = d.id
    }
    // Дубли (та же лицевая сторона в той же колоде) пропускаем — импорт можно повторять
    const existing = new Set(Object.values(notes).filter((n) => n.deck_id === deckId && !n.deleted).map((n) => norm(n.front)))
    for (const c of p.group.cards) {
      if (!c.front || existing.has(norm(c.front))) {
        skipped++
        continue
      }
      existing.add(norm(c.front))
      newNotes.push({
        id: uid(),
        deck_id: deckId,
        front: c.front,
        back: c.back,
        extra: c.extra || {},
        format: c.format || 'md',
        tags: c.tags || [],
        srs: {},
        suspended: false,
        deleted: false,
        created_at: now + newNotes.length,
      })
    }
  }

  upsertRows('sections', newSections, { hold: true })
  upsertRows('decks', newDecks, { hold: true })
  upsertRows('notes', newNotes, { hold: true })
  if (parsed.media.length) await saveMedia(parsed.media)
  if (newNotes.length) askSyncDecision(`Импортировано ${newNotes.length} ${plural(newNotes.length, 'карточка', 'карточки', 'карточек')}`)
  return { sections: newSections.length, decks: newDecks.length, notes: newNotes.length, skipped }
}
