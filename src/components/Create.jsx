import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Upload, Plus } from 'lucide-react'
import { useStore, upsert, upsertRows, uid, askSyncDecision } from '../lib/store'
import { renderContent } from '../lib/render'
import { color } from '../lib/palette'
import { plural } from '../lib/day'
import { go } from '../lib/ui'
import { Sheet, Segmented, toast } from './ui'
import { Pills, liquid } from './fluid'

// «Списком»: строка = карточка. Разделитель — таб, тире, ::, = или ;
// Для вопросов можно блоками: первая строка — вопрос, дальше до пустой строки — ответ
export function parseBulk(text, kind) {
  const out = []
  const SEP = /\t|\s+[—–-]\s+|\s*::\s*|\s+=\s+|\s*;\s*/
  if (kind === 'qa' && /\n\s*\n/.test(text)) {
    for (const block of text.split(/\n\s*\n/)) {
      const lines = block.trim().split('\n')
      if (lines.length < 2) continue
      out.push({ front: lines[0].replace(/^(q|в|вопрос)\s*[:.)]\s*/i, '').trim(), back: lines.slice(1).join('\n').replace(/^(a|о|ответ)\s*[:.)]\s*/i, '').trim() })
    }
    return out
  }
  for (const line of text.split('\n')) {
    const l = line.trim()
    if (!l) continue
    const m = l.split(SEP)
    if (m.length < 2) continue
    const [front, ...rest] = m
    out.push({ front: front.trim(), back: rest.join(', ').trim() })
  }
  return out.filter((c) => c.front && c.back)
}

export function CreateSheet({ open, onClose: close, deckId: fixedDeck, onNewSection }) {
  const sections = useStore((s) => s.sections)
  const decks = useStore((s) => s.decks)
  const liveSections = useMemo(() => Object.values(sections).filter((s) => !s.deleted).sort((a, b) => a.sort - b.sort), [sections])
  const [mode, setMode] = useState('one')
  const [sectionId, setSectionId] = useState(null)
  const [deckId, setDeckId] = useState(null)
  const [newDeck, setNewDeck] = useState(null) // { name, kind }
  const [added, setAdded] = useState(0)
  const onClose = () => {
    close()
    if (added) askSyncDecision(`Добавлено ${added} ${plural(added, 'карточка', 'карточки', 'карточек')}`)
  }

  useEffect(() => {
    if (!open) return
    const last = fixedDeck || localStorage.getItem('mq-lastdeck')
    const d = last && decks[last] && !decks[last].deleted ? decks[last] : null
    const sid = d?.section_id || liveSections[0]?.id || null
    // Запомненной колоды нет — сразу берём первую колоду раздела (эффект ниже может не перезапуститься)
    const first = Object.values(decks)
      .filter((x) => x.section_id === sid && !x.deleted)
      .sort((a, b) => a.sort - b.sort)[0]
    setSectionId(sid)
    setDeckId(d?.id || first?.id || null)
    setNewDeck(null)
    setAdded(0)
    setMode('one')
  }, [open]) // eslint-disable-line

  const sectionDecks = useMemo(() => Object.values(decks).filter((d) => d.section_id === sectionId && !d.deleted).sort((a, b) => a.sort - b.sort), [decks, sectionId])
  useEffect(() => {
    if (sectionDecks.length && !sectionDecks.find((d) => d.id === deckId)) setDeckId(sectionDecks[0].id)
    if (!sectionDecks.length) setDeckId(null)
  }, [sectionDecks]) // eslint-disable-line

  const deck = deckId ? decks[deckId] : null
  const sec = sectionId ? sections[sectionId] : null
  const c = sec ? color(sec.color) : color('indigo')

  function createDeck() {
    if (!newDeck?.name.trim()) return
    const d = upsert('decks', { id: uid(), section_id: sectionId, name: newDeck.name.trim(), kind: newDeck.kind, sort: Date.now(), deleted: false })
    setDeckId(d.id)
    setNewDeck(null)
  }

  function addNotes(cards) {
    const now = Date.now()
    upsertRows(
      'notes',
      cards.map((x, i) => ({ id: uid(), deck_id: deck.id, front: x.front, back: x.back, extra: x.extra || {}, format: 'md', tags: [], srs: {}, suspended: false, deleted: false, created_at: now + i })),
      { hold: true },
    )
    localStorage.setItem('mq-lastdeck', deck.id)
    setAdded((a) => a + cards.length)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Новые карточки">
      {!liveSections.length ? (
        <div className="empty" style={{ padding: '10px 0 20px' }}>
          <p className="muted">Сначала создай раздел — например «Собеседование iOS» или «Английский».</p>
          <button
            className="btn primary"
            onClick={() => {
              onClose()
              onNewSection?.()
            }}
          >
            Создать раздел
          </button>
        </div>
      ) : (
        <>
          {!fixedDeck && (
            <>
              <div className="mono-label" style={{ marginBottom: 8 }}>
                Раздел
              </div>
              <Pills id="csec" value={sectionId} onChange={setSectionId} items={liveSections.map((s) => ({ value: s.id, label: s.name, icon: <span>{s.emoji}</span> }))} />
              <div className="mono-label" style={{ marginBottom: 8 }}>
                Колода
              </div>
              <div className="chips">
                {sectionDecks.map((d) => (
                  <motion.button key={d.id} className={`pill ${deckId === d.id ? 'on' : ''}`} whileTap={{ scale: 0.94 }} onClick={() => setDeckId(d.id)}>
                    {deckId === d.id && <motion.i layoutId="cdeck" className="pill-bg" transition={liquid} />}
                    <span>
                      {d.kind === 'vocab' ? '🔤' : '💬'} {d.name}
                    </span>
                  </motion.button>
                ))}
                <motion.button className="pill" whileTap={{ scale: 0.94 }} onClick={() => setNewDeck({ name: '', kind: /англ|engl/i.test(sec?.name || '') ? 'vocab' : 'qa' })} style={{ color: 'var(--accent)' }}>
                  <span>
                    <Plus size={16} /> Колода
                  </span>
                </motion.button>
              </div>
              <AnimatePresence initial={false}>
                {newDeck && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={liquid} style={{ overflow: 'hidden' }}>
                    <div className="card pad" style={{ boxShadow: 'none', marginBottom: 16 }}>
                      <input className="input" autoFocus value={newDeck.name} onChange={(e) => setNewDeck({ ...newDeck, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && createDeck()} placeholder="Название колоды" />
                      <div style={{ margin: '10px 0' }}>
                        <Segmented
                          full
                          value={newDeck.kind}
                          onChange={(kind) => setNewDeck({ ...newDeck, kind })}
                          options={[
                            { value: 'qa', label: 'Вопрос → ответ' },
                            { value: 'vocab', label: 'Слово ⇄ перевод' },
                          ]}
                        />
                      </div>
                      <button className="btn primary block sm" onClick={createDeck} disabled={!newDeck.name.trim()}>
                        Создать колоду
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          <div style={{ marginBottom: 16 }}>
            <Segmented
              full
              value={mode}
              onChange={setMode}
              options={[
                { value: 'one', label: 'Одна' },
                { value: 'bulk', label: 'Списком' },
                { value: 'file', label: 'Файл' },
              ]}
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={mode + (deck?.id || '')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }} transition={{ type: 'spring', stiffness: 400, damping: 34 }}>
              {mode === 'file' ? (
                <div className="drop card" style={{ cursor: 'pointer' }} onClick={() => go(sectionId ? `/import/${sectionId}` : '/import')}>
                  <Upload size={30} style={{ color: 'var(--accent)' }} />
                  <div style={{ fontWeight: 650, marginTop: 8 }}>.apkg из Anki или .json</div>
                  <div className="small faint">Разложится по разделам и колодам автоматически</div>
                </div>
              ) : !deck ? (
                <div className="small muted" style={{ textAlign: 'center', padding: 20 }}>
                  Создай колоду в этом разделе
                </div>
              ) : mode === 'one' ? (
                <OneCard deck={deck} accent={c} onAdd={(card) => addNotes([card])} />
              ) : (
                <Bulk deck={deck} accent={c} onAdd={addNotes} />
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {added > 0 && (
              <motion.div className="row" style={{ justifyContent: 'center', marginTop: 14 }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={liquid}>
                <motion.span key={added} className="chip accent" initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={liquid}>
                  ✓ Добавлено: {added}
                </motion.span>
                <button className="chip" onClick={onClose}>
                  Готово
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </Sheet>
  )
}

function OneCard({ deck, accent, onAdd }) {
  const vocab = deck.kind === 'vocab'
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [tr, setTr] = useState('')
  const [ex, setEx] = useState('')
  const [flip, setFlip] = useState(false)
  const firstRef = useRef(null)
  const ok = front.trim() && back.trim()

  function save() {
    if (!ok) return
    const extra = vocab ? { transcription: tr.trim() || undefined, example: ex.trim() || undefined } : {}
    onAdd({ front: front.trim(), back: back.trim(), extra })
    setFront('')
    setBack('')
    setTr('')
    setEx('')
    setFlip(false)
    firstRef.current?.focus()
  }

  return (
    <>
      {vocab ? (
        <>
          <input ref={firstRef} className="input" value={front} onChange={(e) => setFront(e.target.value)} placeholder="Слово (English)" style={{ marginBottom: 10 }} autoCapitalize="off" />
          <input className="input" value={back} onChange={(e) => setBack(e.target.value)} placeholder="Перевод, варианты через запятую" style={{ marginBottom: 10 }} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <div className="row" style={{ marginBottom: 10 }}>
            <input className="input" value={tr} onChange={(e) => setTr(e.target.value)} placeholder="[транскрипция]" />
            <input className="input" value={ex} onChange={(e) => setEx(e.target.value)} placeholder="Пример" />
          </div>
        </>
      ) : (
        <>
          <textarea ref={firstRef} className="textarea" value={front} onChange={(e) => setFront(e.target.value)} placeholder="Вопрос" style={{ minHeight: 64, marginBottom: 10 }} />
          <textarea
            className="textarea mono"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && save()}
            placeholder={'Ответ. Markdown, код — в ```swift … ```'}
            style={{ minHeight: 120, marginBottom: 10 }}
          />
        </>
      )}

      {/* Живое превью: тап — перевернуть */}
      <div style={{ perspective: 1200, marginBottom: 14 }}>
        <motion.div className="preview-card" onClick={() => setFlip(!flip)} animate={{ rotateY: flip ? 180 : 0 }} transition={liquid} style={{ transformStyle: 'preserve-3d', position: 'relative', borderTop: `3px solid ${accent.from}` }}>
          <div style={{ backfaceVisibility: 'hidden' }}>
            <div className="mono-label" style={{ fontSize: 10, marginBottom: 8 }}>
              Превью · нажми, чтобы перевернуть
            </div>
            <div className="content" style={{ fontWeight: 650, fontSize: vocab ? 24 : 17, textAlign: vocab ? 'center' : 'left' }} dangerouslySetInnerHTML={{ __html: renderContent(front || (vocab ? 'word' : 'Вопрос…'), 'md') }} />
          </div>
          <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 18, overflow: 'auto' }}>
            <div className="content" style={{ textAlign: vocab ? 'center' : 'left', fontSize: vocab ? 20 : 15 }} dangerouslySetInnerHTML={{ __html: renderContent(back || 'Ответ…', 'md') }} />
          </div>
        </motion.div>
      </div>

      <motion.button className="btn block" style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff' }} whileTap={{ scale: 0.97 }} disabled={!ok} onClick={save}>
        Сохранить и следующая
      </motion.button>
    </>
  )
}

function Bulk({ deck, accent, onAdd }) {
  const [text, setText] = useState('')
  const cards = useMemo(() => parseBulk(text, deck.kind), [text, deck.kind])
  const placeholder =
    deck.kind === 'vocab'
      ? 'come up with — придумать\nthroughput — пропускная способность\ntrade-off — компромисс'
      : 'Что такое ARC? — Автоматический подсчёт ссылок\n\nили блоками:\nЧем struct отличается от class?\nstruct — value type, class — reference type…'
  return (
    <>
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} style={{ minHeight: 150, marginBottom: 10 }} />
      <AnimatePresence>
        {cards.length > 0 && (
          <motion.div className="card" style={{ boxShadow: 'none', marginBottom: 12, overflow: 'hidden' }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={liquid}>
            {cards.slice(0, 6).map((x, i) => (
              <div key={i} className="bulk-line">
                <b>{x.front}</b>
                <span>{x.back}</span>
              </div>
            ))}
            {cards.length > 6 && <div className="bulk-line faint small">и ещё {cards.length - 6}…</div>}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        className="btn block"
        style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff' }}
        whileTap={{ scale: 0.97 }}
        disabled={!cards.length}
        onClick={() => {
          onAdd(cards)
          toast(`Добавлено ${cards.length} ${plural(cards.length, 'карточка', 'карточки', 'карточек')}`)
          setText('')
        }}
      >
        {cards.length ? `Добавить ${cards.length}` : 'Вставь строки — распознаю сам'}
      </motion.button>
    </>
  )
}
