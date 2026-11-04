import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { decompress } from 'fzstd'
import { addCard, finalize, splitPath } from './common'

// .apkg — zip: база collection.anki21b (новый формат, zstd) / anki21 / anki2 + файл media + картинки 0,1,2…

const ZSTD = [0x28, 0xb5, 0x2f, 0xfd]
const isZstd = (b) => ZSTD.every((x, i) => b[i] === x)
const unz = (b) => (isZstd(b) ? decompress(b) : b)

let SQL = null
async function sql() {
  SQL ||= await initSqlJs({ locateFile: () => wasmUrl })
  return SQL
}

function rows(db, query) {
  const res = db.exec(query)
  if (!res.length) return []
  const { columns, values } = res[0]
  return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])))
}

const hasTable = (db, name) => rows(db, `select name from sqlite_master where type='table' and name='${name}'`).length > 0

// Минимальный разбор protobuf для media в новом формате: MediaEntries { repeated MediaEntry entries = 1 { string name = 1 } }
function readVarint(buf, pos) {
  let result = 0
  let shift = 0
  for (;;) {
    const b = buf[pos++]
    result += (b & 0x7f) * 2 ** shift
    if (b < 0x80) return [result, pos]
    shift += 7
  }
}
function parseMediaProto(buf) {
  const names = []
  let pos = 0
  const dec = new TextDecoder()
  while (pos < buf.length) {
    let tag
    ;[tag, pos] = readVarint(buf, pos)
    let len
    ;[len, pos] = readVarint(buf, pos)
    if (tag >> 3 === 1) {
      const entry = buf.subarray(pos, pos + len)
      let p = 0
      let name = ''
      while (p < entry.length) {
        let t
        ;[t, p] = readVarint(entry, p)
        const wire = t & 7
        if (wire === 2) {
          let l
          ;[l, p] = readVarint(entry, p)
          if (t >> 3 === 1) name = dec.decode(entry.subarray(p, p + l))
          p += l
        } else if (wire === 0) [, p] = readVarint(entry, p)
        else if (wire === 5) p += 4
        else if (wire === 1) p += 8
        else break
      }
      names.push(name)
    }
    pos += len
  }
  return names
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }

// Клоз-удаление {{c1::ответ::подсказка}} → вопрос с пропуском и полный ответ
function cloze(text) {
  const front = text.replace(/\{\{c\d+::(.*?)(?:::(.*?))?\}\}/g, (_, _a, hint) => `<span class="cloze">[${hint || '…'}]</span>`)
  const back = text.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '<b class="cloze">$1</b>')
  return { front, back }
}

export async function parseApkg(file) {
  const zip = await JSZip.loadAsync(file)
  const dbFile = zip.file('collection.anki21b') || zip.file('collection.anki21') || zip.file('collection.anki2')
  if (!dbFile) throw new Error('В архиве нет базы Anki (collection.anki2*)')
  const SQLite = await sql()
  const db = new SQLite.Database(unz(new Uint8Array(await dbFile.async('uint8array'))))

  try {
    // Колоды и типы записей: в новом формате — отдельные таблицы, в старом — JSON в col
    const deckNames = {}
    const modelInfo = {}
    if (hasTable(db, 'decks')) {
      for (const d of rows(db, 'select id, name from decks')) deckNames[d.id] = splitPath(d.name)
      for (const m of rows(db, 'select id, name, config from notetypes')) {
        const cfg = m.config instanceof Uint8Array ? m.config : null
        // kind = 1 в protobuf-конфиге — клоз; проще определить по имени и наличию {{c1::
        modelInfo[m.id] = { name: m.name, cloze: /cloze|пропуск/i.test(m.name) || (cfg && cfg[0] === 0x08 && cfg[1] === 0x01) }
      }
      for (const f of rows(db, 'select ntid, ord, name from fields order by ntid, ord')) {
        ;(modelInfo[f.ntid].fields ||= [])[f.ord] = f.name
      }
    } else {
      const col = rows(db, 'select decks, models from col')[0]
      for (const d of Object.values(JSON.parse(col.decks))) deckNames[d.id] = splitPath(d.name)
      for (const m of Object.values(JSON.parse(col.models))) {
        modelInfo[m.id] = { name: m.name, cloze: m.type === 1, fields: m.flds.map((f) => f.name), templates: m.tmpls.length }
      }
    }

    // Колода записи = колода её первой карточки
    const noteDeck = {}
    const noteCards = {}
    for (const c of rows(db, 'select nid, did, ord from cards order by ord')) {
      if (!(c.nid in noteDeck)) noteDeck[c.nid] = c.did
      noteCards[c.nid] = (noteCards[c.nid] || 0) + 1
    }

    const groups = new Map()
    for (const n of rows(db, 'select id, mid, flds, tags from notes')) {
      const flds = String(n.flds).split('\x1f')
      const model = modelInfo[n.mid] || {}
      const names = (model.fields || []).map((s) => (s || '').toLowerCase())
      let front = flds[0] || ''
      let back = flds[1] || ''
      if (model.cloze || /\{\{c\d+::/.test(front)) {
        const c = cloze(front)
        front = c.front
        back = c.back + (flds[1] ? `<hr>${flds[1]}` : '')
      }
      const extra = {}
      names.forEach((nm, i) => {
        if (i < 2 || !flds[i]) return
        if (/transcr|ipa|pronun|транскр/.test(nm)) extra.transcription = flds[i]
        else if (/example|sentence|пример/.test(nm)) extra.example = flds[i]
        else extra.more = (extra.more ? extra.more + '<br>' : '') + flds[i]
      })
      const path = deckNames[noteDeck[n.id]] || ['Anki']
      // Записи с обратными карточками («Basic (and reversed)») — явно словарные
      const kind = noteCards[n.id] > 1 && !model.cloze ? 'vocab' : undefined
      const tags = String(n.tags || '').trim().split(/\s+/).filter(Boolean)
      addCard(groups, path, { front, back, extra, format: 'html', tags }, kind)
    }

    // Медиа: в старом формате JSON {"0": "img.png"}, в новом — zstd + protobuf
    const media = []
    const mediaFile = zip.file('media')
    if (mediaFile) {
      const raw = unz(new Uint8Array(await mediaFile.async('uint8array')))
      let map = {}
      try {
        map = JSON.parse(new TextDecoder().decode(raw))
      } catch {
        parseMediaProto(raw).forEach((name, i) => (map[i] = name))
      }
      const used = new Set()
      for (const g of groups.values()) for (const c of g.cards) for (const m of (c.front + c.back + JSON.stringify(c.extra)).matchAll(/src="([^"]+)"/g)) used.add(m[1])
      for (const [idx, name] of Object.entries(map)) {
        if (!used.has(name)) continue // звуки и неиспользуемое не тащим
        const f = zip.file(idx)
        if (!f) continue
        const bytes = unz(new Uint8Array(await f.async('uint8array')))
        const ext = name.split('.').pop().toLowerCase()
        media.push({ name, blob: new Blob([bytes], { type: MIME[ext] || 'application/octet-stream' }) })
      }
    }
    return finalize(groups, media)
  } finally {
    db.close()
  }
}
