import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../lib/store'
import { useDue, useComposition } from '../lib/hooks'
import { go } from '../lib/ui'
import { gradient } from '../lib/palette'
import { noteStatus, fmtInterval } from '../lib/srs'
import { plain } from '../lib/render'
import Icon from '../components/Icon'
import { TopBar, Segmented } from '../components/ui'
import { DeckEditor, NoteEditor } from '../components/Editors'
import { CreateSheet } from '../components/Create'
import { Composition, Missing } from './Section'

const STATUS = {
  new: { label: 'новая', color: 'var(--text-3)' },
  learning: { label: 'учу', color: 'var(--hard)' },
  review: { label: 'повторяю', color: 'var(--easy)' },
  mature: { label: 'выучено', color: 'var(--good)' },
}

export default function Deck({ id }) {
  const deck = useStore((s) => s.decks[id])
  const section = useStore((s) => (deck ? s.sections[deck.section_id] : null))
  const notes = useStore((s) => s.notes)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [editDeck, setEditDeck] = useState(false)
  const [editing, setEditing] = useState(null) // null | note
  const [create, setCreate] = useState(false)
  const [limit, setLimit] = useState(60)
  const due = useDue({ deckId: id })
  const comp = useComposition([id])

  const rows = useMemo(() => {
    if (!deck) return []
    const needle = q.trim().toLowerCase()
    return Object.values(notes)
      .filter((n) => n.deck_id === id && !n.deleted)
      .map((n) => ({ n, st: noteStatus(n, deck) }))
      .filter(({ n, st }) => (filter === 'all' || st.status === filter) && (!needle || (n.front + ' ' + n.back).toLowerCase().includes(needle)))
      .sort((a, b) => b.n.created_at - a.n.created_at)
  }, [notes, id, deck, q, filter])

  if (!deck || deck.deleted) return <Missing />

  return (
    <div className="screen">
      <TopBar
        title={deck.name}
        fallback={`/s/${deck.section_id}`}
        right={
          <button className="icon-btn" onClick={() => setEditDeck(true)} aria-label="Настроить колоду">
            <Icon name="edit" size={19} />
          </button>
        }
      />
      <div className="row" style={{ gap: 10 }}>
        <button className="btn primary" style={{ flex: 1, background: section ? gradient(section.color) : undefined }} disabled={!due.total} onClick={() => go(`/study/d:${id}`)}>
          <Icon name="play" size={15} /> {due.total ? `Учить · ${due.total}` : 'На сегодня всё'}
        </button>
        <button className="btn secondary" disabled={!comp.total} onClick={() => go(`/study/cram:d:${id}`)} title="Прогон всех карточек без влияния на расписание">
          <Icon name="bolt" size={17} /> Прогон
        </button>
      </div>

      <Composition comp={comp} />

      <div className="section-label">Карточки · {comp.total}</div>
      <div className="search">
        <Icon name="search" size={18} />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" />
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 12 }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Все' },
            { value: 'new', label: 'Новые' },
            { value: 'learning', label: 'Учу' },
            { value: 'review', label: 'Повтор' },
            { value: 'mature', label: 'Выучено' },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div className="card empty">
          <div className="big">{comp.total ? '🔍' : '✨'}</div>
          <h3>{comp.total ? 'Ничего не найдено' : 'Колода пуста'}</h3>
          {!comp.total && (
            <button className="btn primary" style={{ marginTop: 10 }} onClick={() => setCreate(true)}>
              <Icon name="plus" size={18} /> Добавить карточку
            </button>
          )}
        </div>
      ) : (
        <div className="card list">
          <AnimatePresence initial={false}>
            {rows.slice(0, limit).map(({ n, st }) => (
              <motion.button
                layout="position"
                key={n.id}
                className="list-item"
                onClick={() => setEditing(n)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
              >
                <i className="dot" style={{ background: STATUS[st.status].color }} />
                <div className="main">
                  <div className="t">{plain(n.front, 90)}</div>
                  <div className="s">{plain(n.back, 110)}</div>
                </div>
                {st.due && <span className="small faint tnum">{st.due <= Date.now() ? 'сейчас' : fmtInterval(st.due - Date.now())}</span>}
              </motion.button>
            ))}
          </AnimatePresence>
          {rows.length > limit && (
            <button className="list-item" style={{ justifyContent: 'center', color: 'var(--accent)', fontWeight: 600 }} onClick={() => setLimit(limit + 100)}>
              Показать ещё {rows.length - limit}
            </button>
          )}
        </div>
      )}

      <motion.button className="fab low" whileTap={{ scale: 0.9 }} onClick={() => setCreate(true)} aria-label="Новая карточка" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}>
        <Icon name="plus" size={26} stroke={2.4} />
      </motion.button>

      <DeckEditor open={editDeck} onClose={() => setEditDeck(false)} deck={deck} sectionId={deck.section_id} />
      <NoteEditor open={!!editing} onClose={() => setEditing(null)} deck={deck} note={editing} />
      <CreateSheet open={create} onClose={() => setCreate(false)} deckId={id} />
    </div>
  )
}
