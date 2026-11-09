import { useEffect, useState } from 'react'
import { getState, upsert, patch, remove, uid } from '../lib/store'
import { PALETTE, EMOJIS, gradient } from '../lib/palette'
import { renderContent } from '../lib/render'
import { back } from '../lib/ui'
import { Sheet, Segmented, toast } from './ui'
import Icon from './Icon'
import { confirmDialog } from './Dialog'

export function SectionEditor({ open, onClose, section }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💼')
  const [col, setCol] = useState('indigo')
  const [goal, setGoal] = useState(null)

  useEffect(() => {
    if (!open) return
    setName(section?.name || '')
    setEmoji(section?.emoji || '💼')
    setCol(section?.color || PALETTE[Object.keys(getState().sections).length % PALETTE.length].id)
    setGoal(section?.goal ?? null)
  }, [open, section])

  function save() {
    if (!name.trim()) return
    if (section) patch('sections', section.id, { name: name.trim(), emoji, color: col, goal })
    else upsert('sections', { id: uid(), name: name.trim(), emoji, color: col, goal, sort: Date.now(), deleted: false })
    onClose()
  }

  async function del() {
    if (!(await confirmDialog({ title: `Удалить раздел «${section.name}»?`, text: 'Вместе с колодами. Всё попадёт в корзину — вернуть можно в Настройках.', ok: 'Удалить', danger: true }))) return
    const { decks } = getState()
    for (const d of Object.values(decks)) if (d.section_id === section.id && !d.deleted) remove('decks', d.id)
    remove('sections', section.id)
    onClose()
    back()
  }

  return (
    <Sheet open={open} onClose={onClose} title={section ? 'Раздел' : 'Новый раздел'}>
      <div className="row" style={{ marginBottom: 18 }}>
        <div className="section-card" style={{ padding: 0, width: 'auto' }}>
          <div className="emoji" style={{ background: gradient(col) }}>
            {emoji}
          </div>
        </div>
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Собеседование iOS" onKeyDown={(e) => e.key === 'Enter' && save()} />
      </div>
      <div className="field">
        <span>Цвет</span>
        <div className="swatches">
          {PALETTE.map((p) => (
            <button key={p.id} className={col === p.id ? 'on' : ''} style={{ background: gradient(p.id) }} onClick={() => setCol(p.id)} aria-label={p.id} />
          ))}
        </div>
      </div>
      <div className="field">
        <span>Иконка</span>
        <div className="emojis">
          {EMOJIS.map((e) => (
            <button key={e} className={emoji === e ? 'on' : ''} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {section && (
          <button className="btn danger" onClick={del} aria-label="Удалить">
            <Icon name="trash" size={18} />
          </button>
        )}
        <button className="btn primary block" style={{ flex: 1 }} onClick={save} disabled={!name.trim()}>
          {section ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </Sheet>
  )
}

export function DeckEditor({ open, onClose, sectionId, deck }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('qa')

  useEffect(() => {
    if (!open) return
    setName(deck?.name || '')
    setKind(deck?.kind || 'qa')
  }, [open, deck])

  function save() {
    if (!name.trim()) return
    if (deck) patch('decks', deck.id, { name: name.trim(), kind })
    else upsert('decks', { id: uid(), section_id: sectionId, name: name.trim(), kind, sort: Date.now(), deleted: false })
    onClose()
  }

  async function del() {
    if (!(await confirmDialog({ title: `Удалить колоду «${deck.name}»?`, text: 'Она попадёт в корзину — вернуть можно в Настройках.', ok: 'Удалить', danger: true }))) return
    remove('decks', deck.id)
    onClose()
    back()
  }

  return (
    <Sheet open={open} onClose={onClose} title={deck ? 'Колода' : 'Новая колода'}>
      <label className="field">
        <span>Название</span>
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Многопоточность" onKeyDown={(e) => e.key === 'Enter' && save()} />
      </label>
      <div className="field">
        <span>Тип карточек</span>
        <Segmented
          full
          value={kind}
          onChange={setKind}
          options={[
            { value: 'qa', label: 'Вопрос → ответ' },
            { value: 'vocab', label: 'Слово ⇄ перевод' },
          ]}
        />
        <div className="small faint" style={{ padding: '2px 4px' }}>
          {kind === 'qa' ? 'Пишешь ответ своими словами и сверяешь с эталоном.' : 'Каждое слово учится в обе стороны: EN → RU и RU → EN, с озвучкой.'}
        </div>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {deck && (
          <button className="btn danger" onClick={del} aria-label="Удалить">
            <Icon name="trash" size={18} />
          </button>
        )}
        <button className="btn primary block" style={{ flex: 1 }} onClick={save} disabled={!name.trim()}>
          {deck ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </Sheet>
  )
}

export function NoteEditor({ open, onClose, deck, note }) {
  const vocab = deck?.kind === 'vocab'
  const [front, setFront] = useState('')
  const [backText, setBack] = useState('')
  const [transcription, setTr] = useState('')
  const [example, setEx] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (!open) return
    setFront(note?.front || '')
    setBack(note?.back || '')
    setTr(note?.extra?.transcription || '')
    setEx(note?.extra?.example || '')
    setPreview(false)
  }, [open, note])

  function save(more) {
    if (!front.trim() || !backText.trim()) return
    const extra = { ...(note?.extra || {}) }
    if (vocab) {
      extra.transcription = transcription.trim() || undefined
      extra.example = example.trim() || undefined
    }
    if (note) patch('notes', note.id, { front: front.trim(), back: backText.trim(), extra })
    else
      upsert('notes', {
        id: uid(),
        deck_id: deck.id,
        front: front.trim(),
        back: backText.trim(),
        extra,
        format: 'md',
        tags: [],
        srs: {},
        suspended: false,
        deleted: false,
        created_at: Date.now(),
      })
    if (more) {
      setFront('')
      setBack('')
      setTr('')
      setEx('')
      toast('Карточка добавлена')
    } else onClose()
  }

  function del() {
    remove('notes', note.id)
    onClose()
  }

  const html = note?.format === 'html'
  return (
    <Sheet open={open} onClose={onClose} title={note ? 'Карточка' : 'Новая карточка'}>
      {vocab ? (
        <>
          <label className="field">
            <span>Слово или фраза (English)</span>
            <input className="input" autoFocus value={front} onChange={(e) => setFront(e.target.value)} placeholder="to come up with" />
          </label>
          <label className="field">
            <span>Перевод (варианты через запятую)</span>
            <input className="input" value={backText} onChange={(e) => setBack(e.target.value)} placeholder="придумать, предложить" />
          </label>
          <label className="field">
            <span>Транскрипция</span>
            <input className="input" value={transcription} onChange={(e) => setTr(e.target.value)} placeholder="[kʌm ʌp wɪð]" />
          </label>
          <label className="field">
            <span>Пример</span>
            <input className="input" value={example} onChange={(e) => setEx(e.target.value)} placeholder="She came up with a great idea." />
          </label>
        </>
      ) : (
        <>
          <label className="field">
            <span>Вопрос</span>
            <textarea className="textarea" autoFocus value={front} onChange={(e) => setFront(e.target.value)} placeholder="Чем struct отличается от class?" style={{ minHeight: 80 }} />
          </label>
          <div className="field">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small" style={{ fontWeight: 600, color: 'var(--text-2)', paddingLeft: 4 }}>
                Ответ {html ? '(HTML из Anki)' : '· Markdown, код в ```'}
              </span>
              <Segmented
                value={preview ? 'p' : 'e'}
                onChange={(v) => setPreview(v === 'p')}
                options={[
                  { value: 'e', label: 'Текст' },
                  { value: 'p', label: 'Вид' },
                ]}
              />
            </div>
            {preview ? (
              <div className="content card pad" style={{ boxShadow: 'none', minHeight: 160 }} dangerouslySetInnerHTML={{ __html: renderContent(backText, note?.format) }} />
            ) : (
              <textarea
                className="textarea mono"
                value={backText}
                onChange={(e) => setBack(e.target.value)}
                placeholder={'struct — тип-значение, копируется…\n\n```swift\nstruct Point { var x: Int }\n```'}
                style={{ minHeight: 200 }}
              />
            )}
          </div>
        </>
      )}
      {note && (
        <button
          className="btn block secondary"
          style={{ marginTop: 4, marginBottom: 6 }}
          onClick={() => {
            patch('notes', note.id, { suspended: !note.suspended })
            toast(note.suspended ? 'Карточка снова в учёбе' : 'Больше не попадётся. Вернуть — в колоде, фильтр «Не учу»')
            onClose()
          }}
        >
          {note.suspended ? '↩︎ Вернуть в учёбу' : '🚫 Не учить эту карточку'}
        </button>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        {note ? (
          <button className="btn danger" onClick={del} aria-label="Удалить">
            <Icon name="trash" size={18} />
          </button>
        ) : (
          <button className="btn secondary" onClick={() => save(true)} disabled={!front.trim() || !backText.trim()}>
            + Ещё
          </button>
        )}
        <button className="btn primary block" style={{ flex: 1 }} onClick={() => save(false)} disabled={!front.trim() || !backText.trim()}>
          Сохранить
        </button>
      </div>
    </Sheet>
  )
}
