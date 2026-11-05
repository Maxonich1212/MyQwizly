import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { useDue, useComposition, useSectionStreaks, CATEGORIES } from '../lib/hooks'
import { go } from '../lib/ui'
import { gradient, color } from '../lib/palette'
import { plural } from '../lib/day'
import Icon from '../components/Icon'
import { TopBar, Flame, Pressable, Sheet, soft } from '../components/ui'
import { SectionEditor, DeckEditor } from '../components/Editors'
import { CreateSheet } from '../components/Create'
import GoSheet from '../components/GoSheet'
import { plain } from '../lib/render'
import { Rocket } from 'lucide-react'

export default function Section({ id }) {
  const section = useStore((s) => s.sections[id])
  const decks = useStore((s) => s.decks)
  const [editSection, setEditSection] = useState(false)
  const [newDeck, setNewDeck] = useState(false)
  const [create, setCreate] = useState(false)
  const [goOpen, setGoOpen] = useState(false)
  const [pick, setPick] = useState(null)
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
        {/* Главное действие — «Погнали» на всю ширину, остальное ровной сеткой под ним: ничего не уезжает за край */}
        <button className="btn block" style={{ marginTop: 18, background: '#fff', color: c.from, boxShadow: '0 6px 18px rgba(0,0,0,.12)' }} disabled={!comp.total} onClick={() => setGoOpen(true)}>
          <Rocket size={17} /> Погнали
        </button>
        <div className="hero-actions">
          <button disabled={!due.total} onClick={() => go(`/study/s:${id}`)}>
            <Icon name="play" size={14} /> {due.total ? `Повторить · ${due.total}` : 'Повторять нечего'}
          </button>
          <button onClick={() => setCreate(true)} aria-label="Добавить карточки">
            <Icon name="plus" size={17} />
          </button>
        </div>
      </motion.div>

      <Composition comp={comp} onPick={setPick} />

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
      <CategorySheet cat={pick} ids={pick ? comp.ids[pick] : []} onClose={() => setPick(null)} />
      <GoSheet open={goOpen} onClose={() => setGoOpen(false)} scope={`s:${id}`} title={`Погнали · ${section.name}`} />
    </div>
  )
}

// Состав: полоса и четыре плашки-кнопки. onPick(категория) — показать эти карточки
export function Composition({ comp, onPick, active }) {
  return (
    <div className="card pad comp-card" style={{ marginTop: 14 }}>
      <div className="comp-bar">
        {CATEGORIES.map((p, i) =>
          comp[p.k] ? (
            <motion.i
              key={p.k}
              style={{ background: p.color }}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: comp[p.k] }}
              transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null,
        )}
      </div>
      <div className="comp-grid">
        {CATEGORIES.map((p) => (
          <motion.button
            key={p.k}
            className={`comp-chip ${active === p.k ? 'on' : ''}`}
            style={{ '--c': p.color }}
            whileTap={{ scale: 0.94 }}
            disabled={!comp[p.k]}
            onClick={() => onPick?.(active === p.k ? null : p.k)}
          >
            <b className="tnum">{comp[p.k]}</b>
            <span>
              <i className="dot" style={{ background: p.color }} />
              {p.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// Список карточек одной категории раздела + «Повторить эти»
export function CategorySheet({ cat, ids, onClose }) {
  const notes = useStore((s) => s.notes)
  const decks = useStore((s) => s.decks)
  const meta = CATEGORIES.find((c) => c.k === cat)
  const list = (ids || []).map((id) => notes[id]).filter(Boolean)
  const practice = () => {
    sessionStorage.setItem('mq-go-ids', JSON.stringify(ids))
    onClose()
    go(`/study/go:${ids.length}:ids`)
  }
  return (
    <Sheet open={!!cat} onClose={onClose} title={meta ? `${meta.label} · ${list.length}` : ''}>
      {meta && (
        <>
          <button className="btn primary block" style={{ marginBottom: 14 }} onClick={practice} disabled={!list.length}>
            <Rocket size={17} /> Повторить эти · {list.length}
          </button>
          <div className="card list" style={{ boxShadow: 'none' }}>
            {list.slice(0, 200).map((n) => (
              <button key={n.id} className="list-item" onClick={() => (onClose(), go(`/d/${n.deck_id}`))}>
                <i className="dot" style={{ background: meta.color }} />
                <div className="main">
                  <div className="t">{plain(n.front, 90)}</div>
                  <div className="s">
                    {decks[n.deck_id]?.name} · {plain(n.back, 70)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
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
            {comp.total ? ` · знаю ${comp.known} из ${comp.total}` : ''}
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
