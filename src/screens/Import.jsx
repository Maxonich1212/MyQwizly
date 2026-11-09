import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, getState } from '../lib/store'
import { parseFile, planImport, commitImport } from '../lib/import'
import { go } from '../lib/ui'
import { plain } from '../lib/render'
import { plural } from '../lib/day'
import { EMOJIS, pickEmoji } from '../lib/palette'
import Icon from '../components/Icon'
import { TopBar, soft, spring } from '../components/ui'
import { PACKS } from '../lib/packs/phrases'

const JSON_EXAMPLE = `{
  "sections": [
    { "name": "Собеседование iOS",
      "decks": [
        { "name": "Swift",
          "cards": [
            { "question": "struct vs class?", "answer": "struct — value type…" }
          ] }
      ] },
    { "name": "Английский",
      "decks": [
        { "name": "Глаголы",
          "cards": [
            { "word": "come up with", "translation": "придумать",
              "example": "She came up with a plan." }
          ] }
      ] }
  ]
}`

export default function Import({ sectionId }) {
  const sections = useStore((s) => s.sections)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [target, setTarget] = useState(sectionId || 'auto')
  const [kinds, setKinds] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [over, setOver] = useState(false)
  const [help, setHelp] = useState(false)
  const inputRef = useRef(null)
  const baseName = file ? file.name.replace(/\.[^.]+$/, '') : ''

  async function pick(f) {
    if (!f) return
    setFile(f)
    setError('')
    setParsed(null)
    setResult(null)
    setBusy(true)
    try {
      const p = await parseFile(f)
      if (!p.total) throw new Error('Не нашёл в файле ни одной карточки')
      setParsed(p)
      setKinds({})
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // Свои названия и иконки: правки разделов по исходному имени, колод — по номеру в плане
  const [secEdit, setSecEdit] = useState({})
  const [deckNames, setDeckNames] = useState({})
  const [emojiFor, setEmojiFor] = useState(null)

  const plan = useMemo(() => {
    if (!parsed) return []
    return planImport(parsed, target, baseName).map((p, i) => {
      const o = secEdit[p.sectionName] || {}
      return {
        ...p,
        kind: kinds[i] || p.kind,
        sectionKey: p.sectionName,
        sectionName: o.name?.trim() || p.sectionName,
        emoji: o.emoji,
        deckName: deckNames[i]?.trim() || p.deckName,
      }
    })
  }, [parsed, target, baseName, kinds, sections, secEdit, deckNames]) // eslint-disable-line

  // Группируем план по разделам для превью
  const tree = useMemo(() => {
    const m = new Map()
    plan.forEach((p, i) => {
      if (!m.has(p.sectionKey)) m.set(p.sectionKey, { key: p.sectionKey, name: p.sectionName, emoji: p.emoji || (p.sectionId ? sections[p.sectionId]?.emoji : pickEmoji(p.sectionName)), exists: !!p.sectionId, decks: [] })
      m.get(p.sectionKey).decks.push({ ...p, i })
    })
    return [...m.values()]
  }, [plan])

  async function run() {
    setBusy(true)
    try {
      setResult(await commitImport(parsed, plan))
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const liveSections = Object.values(sections).filter((s) => !s.deleted)

  // Готовый набор кладём в раздел, где уже лежат английские слова; если такого нет — в новый «Английский»
  async function addPack(p) {
    const st = getState()
    const vocabDeck = Object.values(st.decks).find((d) => !d.deleted && d.kind === 'vocab' && st.sections[d.section_id] && !st.sections[d.section_id].deleted)
    const cards = p.cards()
    const pack = { groups: [{ path: [p.name], kind: 'vocab', cards }], media: [], total: cards.length }
    const plan = planImport(pack, sectionId || vocabDeck?.section_id || { newName: 'Английский' }, p.name)
    setBusy(true)
    try {
      setResult(await commitImport(pack, plan))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen no-tabs">
      <TopBar title="Импорт" />

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div key="done" className="card empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={soft}>
            <motion.div className="big" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}>
              🎉
            </motion.div>
            <h3>
              Добавлено {result.notes} {plural(result.notes, 'карточка', 'карточки', 'карточек')}
            </h3>
            <p className="muted" style={{ margin: '0 0 18px' }}>
              {result.sections ? `Новых разделов: ${result.sections}. ` : ''}
              {result.decks ? `Новых колод: ${result.decks}. ` : ''}
              {result.skipped ? `Пропущено дублей: ${result.skipped}.` : ''}
            </p>
            <button className="btn primary" onClick={() => go(sectionId ? `/s/${sectionId}` : '/')}>
              Готово
            </button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <label
              className={`drop card ${over ? 'over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setOver(false)
                pick(e.dataTransfer.files[0])
              }}
            >
              <input ref={inputRef} type="file" accept=".apkg,.colpkg,.json,.jsonl,application/json" hidden onChange={(e) => pick(e.target.files[0])} />
              <motion.div animate={busy ? { rotate: 360 } : { rotate: 0 }} transition={busy ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}} style={{ display: 'inline-block', color: 'var(--accent)' }}>
                <Icon name={busy ? 'shuffle' : file ? 'file' : 'upload'} size={34} />
              </motion.div>
              <div style={{ fontWeight: 650, marginTop: 10 }}>{file ? file.name : 'Выбери файл .apkg или .json'}</div>
              <div className="small faint" style={{ marginTop: 4 }}>
                {busy ? 'Разбираю…' : parsed ? `${parsed.total} ${plural(parsed.total, 'карточка', 'карточки', 'карточек')}${parsed.media.length ? ` · ${parsed.media.length} картинок` : ''}` : 'Можно перетащить сюда'}
              </div>
            </label>

            {error && (
              <div className="error" style={{ marginTop: 14 }}>
                {error}
              </div>
            )}

            {!parsed && !busy && (
              <>
                <div className="section-label">Готовые наборы</div>
                {PACKS.map((p) => (
                  <motion.button key={p.id} className="card pack-card" whileTap={{ scale: 0.98 }} transition={spring} onClick={() => addPack(p)}>
                    <span className="pack-emoji">{p.emoji}</span>
                    <span className="main">
                      <b>
                        {p.name} · {p.cards().length}
                      </b>
                      <small>{p.hint}</small>
                    </span>
                    <span className="pack-add">
                      <Icon name="plus" size={18} />
                    </span>
                  </motion.button>
                ))}
              </>
            )}

            {parsed && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={soft}>
                <div className="section-label">Куда положить</div>
                <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="auto">Автоматически — разделы и колоды как в файле</option>
                  {liveSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      Всё в раздел: {s.emoji} {s.name}
                    </option>
                  ))}
                </select>

                <div className="section-label">Как разложится</div>
                {tree.map((sec) => (
                  <div key={sec.key} className="card" style={{ marginBottom: 10, overflow: 'hidden' }}>
                    <div className="tree-item" style={{ background: 'var(--surface-2)' }}>
                      <button className="imp-emoji" disabled={sec.exists} onClick={() => setEmojiFor(emojiFor === sec.key ? null : sec.key)} aria-label="Иконка раздела">
                        {sec.emoji}
                      </button>
                      {sec.exists ? (
                        <b style={{ flex: 1 }}>{sec.name}</b>
                      ) : (
                        <input
                          className="imp-input strong"
                          value={secEdit[sec.key]?.name ?? sec.name}
                          onChange={(e) => setSecEdit((x) => ({ ...x, [sec.key]: { ...x[sec.key], name: e.target.value } }))}
                          placeholder="Название раздела"
                        />
                      )}
                      <span className={`chip ${sec.exists ? '' : 'accent'}`}>{sec.exists ? 'есть' : 'новый'}</span>
                    </div>
                    <AnimatePresence initial={false}>
                      {emojiFor === sec.key && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                          <div className="emojis" style={{ padding: 10 }}>
                            {EMOJIS.map((e) => (
                              <button
                                key={e}
                                className={sec.emoji === e ? 'on' : ''}
                                onClick={() => {
                                  setSecEdit((x) => ({ ...x, [sec.key]: { ...x[sec.key], emoji: e } }))
                                  setEmojiFor(null)
                                }}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {sec.decks.map((d) => (
                      <div key={d.i} className="tree-item">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {d.deckId ? (
                            <div style={{ fontWeight: 600 }}>{d.deckName}</div>
                          ) : (
                            <input
                              className="imp-input"
                              value={deckNames[d.i] ?? d.deckName}
                              onChange={(e) => setDeckNames((x) => ({ ...x, [d.i]: e.target.value }))}
                              placeholder="Название колоды"
                            />
                          )}
                          <div className="small faint" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {d.group.cards.length} · напр. «{plain(d.group.cards[0].front, 40)}»
                          </div>
                        </div>
                        <motion.button
                          className="chip"
                          whileTap={{ scale: 0.9 }}
                          transition={spring}
                          disabled={!!d.deckId}
                          onClick={() => setKinds((k) => ({ ...k, [d.i]: d.kind === 'vocab' ? 'qa' : 'vocab' }))}
                          title="Сменить тип"
                        >
                          {d.kind === 'vocab' ? '🔤 слова' : '💬 вопросы'}
                        </motion.button>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="small faint" style={{ margin: '4px 4px 16px' }}>
                  Названия и иконки новых разделов и колод можно поменять прямо здесь. Тип колоды определён автоматически — нажми на него, чтобы сменить. Дубли пропускаются.
                </div>
                <button className="btn primary block" onClick={run} disabled={busy}>
                  Импортировать {parsed.total}
                </button>
              </motion.div>
            )}

            <button className="btn secondary block" style={{ marginTop: 22 }} onClick={() => setHelp(!help)}>
              {help ? 'Скрыть' : 'Какой JSON понимается?'}
            </button>
            <AnimatePresence>
              {help && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                  <div className="content small muted" style={{ padding: '14px 4px 0' }}>
                    <p>
                      Почти любой: массив карточек, вложенные разделы и колоды, словарь <code>{'{"apple": "яблоко"}'}</code>. Поля узнаются по названиям: <code>question/answer</code>,{' '}
                      <code>front/back</code>, <code>word/translation</code>, <code>term/definition</code>, <code>en/ru</code>, а также <code>example</code>, <code>transcription</code>.
                      Группу можно указать прямо в карточке: <code>{'"deck": "Собеседование::Swift"'}</code>.
                    </p>
                    <pre className="code">
                      <code>{JSON_EXAMPLE}</code>
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
