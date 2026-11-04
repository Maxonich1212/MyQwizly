import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { useDue, useComposition, useSectionStreaks } from '../lib/hooks'
import { go } from '../lib/ui'
import { gradient, color } from '../lib/palette'
import { plural } from '../lib/day'
import Icon from '../components/Icon'
import { TopBar, Flame, Pressable, soft } from '../components/ui'
import { SectionEditor, DeckEditor } from '../components/Editors'
import { CreateSheet } from '../components/Create'

export default function Section({ id }) {
  const section = useStore((s) => s.sections[id])
  const decks = useStore((s) => s.decks)
  const [editSection, setEditSection] = useState(false)
  const [newDeck, setNewDeck] = useState(false)
  const [create, setCreate] = useState(false)
  const list = useMemo(() => Object.values(decks).filter((d) => d.section_id === id && !d.deleted).sort((a, b) => a.sort - b.sort), [decks, id])
  const due = useDue({ sectionId: id })
  const comp = useComposition(list.map((d) => d.id))
  const st = useSectionStreaks()[id]

  if (!section || section.deleted) return <Missing />
  const c = color(section.color)

  return (
    <div className="screen">
      <TopBar
        fallback="/cards"
        right={
          <button className="icon-btn" onClick={() => setEditSection(true)} aria-label="Настроить раздел">
            <Icon name="edit" size={19} />
          </button>
        }
      />
      <motion.div
        className="card hero"
        style={{ background: gradient(section.color), color: '#fff', border: 0, boxShadow: `0 18px 40px -16px ${c.from}` }}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={soft}
      >
        <div style={{ position: 'absolute', right: -20, top: -30, fontSize: 150, opacity: 0.16, transform: 'rotate(12deg)', pointerEvents: 'none' }}>{section.emoji}</div>
        <div style={{ fontSize: 34, marginBottom: 6 }}>{section.emoji}</div>
        <h1 className="title" style={{ margin: '0 0 4px', color: '#fff' }}>
          {section.name}
        </h1>
        <div style={{ opacity: 0.85, fontWeight: 600, fontSize: 14.5 }} className="row">
          <span>
            {comp.total} {plural(comp.total, 'карточка', 'карточки', 'карточек')} · {list.length} {plural(list.length, 'колода', 'колоды', 'колод')}
          </span>
          {st?.current > 0 && (
            <span className="row" style={{ gap: 3 }}>
              · <Flame size={15} animated={false} active /> {st.current} {plural(st.current, 'день', 'дня', 'дней')}
            </span>
          )}
        </div>
        <div className="row" style={{ marginTop: 18, gap: 10 }}>
          <button
            className="btn"
            style={{ background: '#fff', color: c.from, flex: 1, boxShadow: '0 6px 18px rgba(0,0,0,.12)' }}
            disabled={!due.total}
            onClick={() => go(`/study/s:${id}`)}
          >
            <Icon name="play" size={15} /> {due.total ? `Учить · ${due.total}` : 'Всё повторено'}
          </button>
          <button className="btn" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', padding: '0 16px' }} disabled={!comp.total} onClick={() => go(`/study/cram:s:${id}`)} title="Прогон всех карточек без влияния на расписание">
            <Icon name="bolt" size={18} /> Прогон
          </button>
          <button className="btn" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', padding: '0 16px' }} onClick={() => setCreate(true)} aria-label="Добавить карточки">
            <Icon name="plus" size={20} />
          </button>
        </div>
      </motion.div>

      <Composition comp={comp} />

      <div className="section-label">
        Колоды
        <button onClick={() => setNewDeck(true)}>+ Колода</button>
      </div>
      {list.length === 0 ? (
        <div className="card empty">
          <div className="big">🃏</div>
          <h3>Нет колод</h3>
          <p className="muted" style={{ margin: '0 0 18px' }}>
            Создай колоду вручную или импортируй .apkg / .json — карточки разложатся сами.
          </p>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => setNewDeck(true)}>
              <Icon name="plus" size={18} /> Колода
            </button>
            <button className="btn secondary" onClick={() => go(`/import/${id}`)}>
              <Icon name="upload" size={18} /> Импорт
            </button>
          </div>
        </div>
      ) : (
        <motion.div className="card list" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
          {list.map((d) => (
            <DeckRow key={d.id} deck={d} sectionColor={section.color} />
          ))}
        </motion.div>
      )}

      <SectionEditor open={editSection} onClose={() => setEditSection(false)} section={section} />
      <DeckEditor open={newDeck} onClose={() => setNewDeck(false)} sectionId={id} />
      <CreateSheet open={create} onClose={() => setCreate(false)} />
    </div>
  )
}

export function Composition({ comp }) {
  const parts = [
    { k: 'new', label: 'Новые', color: 'var(--text-3)' },
    { k: 'learning', label: 'Учу', color: 'var(--hard)' },
    { k: 'review', label: 'Повторяю', color: 'var(--easy)' },
    { k: 'mature', label: 'Выучено', color: 'var(--good)' },
  ]
  return (
    <div className="card pad" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: 'var(--surface-3)', gap: 2 }}>
        {parts.map((p, i) =>
          comp[p.k] ? (
            <motion.i
              key={p.k}
              style={{ background: p.color, display: 'block', height: '100%' }}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: comp[p.k] }}
              transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null,
        )}
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        {parts.map((p) => (
          <div key={p.k} className="col" style={{ gap: 1 }}>
            <b className="tnum" style={{ fontSize: 18 }}>{comp[p.k]}</b>
            <span className="small faint row" style={{ gap: 5 }}>
              <i className="dot" style={{ background: p.color }} />
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DeckRow({ deck, sectionColor }) {
  const due = useDue({ deckId: deck.id })
  const comp = useComposition([deck.id])
  return (
    <motion.div variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}>
      <Pressable className="list-item" onClick={() => go(`/d/${deck.id}`)}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', fontSize: 19 }}>
          {deck.kind === 'vocab' ? '🔤' : '💬'}
        </div>
        <div className="main">
          <div className="t">{deck.name}</div>
          <div className="s">
            {comp.total} {plural(comp.total, 'карточка', 'карточки', 'карточек')}
            {comp.total ? ` · выучено ${Math.round((comp.mature / comp.total) * 100)}%` : ''}
          </div>
        </div>
        {due.total > 0 && (
          <span className="due-badge" style={{ background: gradient(sectionColor) }}>
            {due.total}
          </span>
        )}
        <Icon name="chevron" size={18} style={{ color: 'var(--text-3)' }} />
      </Pressable>
    </motion.div>
  )
}

export function Missing() {
  return (
    <div className="screen">
      <TopBar fallback="/cards" />
      <div className="card empty">
        <div className="big">🫥</div>
        <h3>Не найдено</h3>
        <p className="muted">Возможно, удалено на другом устройстве.</p>
      </div>
    </div>
  )
}
