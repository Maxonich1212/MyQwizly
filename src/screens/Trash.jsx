import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RotateCcw, Archive } from 'lucide-react'
import { useStore, getState, patch } from '../lib/store'
import { plain } from '../lib/render'
import { plural } from '../lib/day'
import HabitIcon from '../components/HabitIcon'
import { TopBar, toast } from '../components/ui'
import { liquid } from '../components/fluid'

// Всё «удалённое» на самом деле только помечено deleted — отсюда можно вернуть
function ago(ts) {
  const d = Math.floor((Date.now() - ts) / 864e5)
  if (d < 1) return 'сегодня'
  if (d === 1) return 'вчера'
  return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`
}

function restoreSection(s) {
  const { decks } = getState()
  patch('sections', s.id, { deleted: false })
  // Колоды, удалённые вместе с разделом (в пределах минуты), возвращаем тоже
  for (const d of Object.values(decks)) if (d.section_id === s.id && d.deleted && Math.abs(d.updated_at - s.updated_at) < 60e3) patch('decks', d.id, { deleted: false })
}

function restoreDeck(d) {
  const sec = getState().sections[d.section_id]
  if (sec?.deleted) patch('sections', sec.id, { deleted: false })
  patch('decks', d.id, { deleted: false })
}

function restoreNote(n) {
  const deck = getState().decks[n.deck_id]
  if (deck?.deleted) restoreDeck(deck)
  patch('notes', n.id, { deleted: false })
}

export default function Trash() {
  const habits = useStore((s) => s.habits)
  const sections = useStore((s) => s.sections)
  const decks = useStore((s) => s.decks)
  const notes = useStore((s) => s.notes)

  const groups = useMemo(() => {
    const by = (o, f) => Object.values(o).filter(f).sort((a, b) => b.updated_at - a.updated_at)
    return [
      { key: 'archived', title: 'Архив привычек', items: by(habits, (h) => h.archived && !h.deleted), kind: 'habit-archive' },
      { key: 'habits', title: 'Привычки', items: by(habits, (h) => h.deleted), kind: 'habit' },
      { key: 'sections', title: 'Разделы', items: by(sections, (s) => s.deleted), kind: 'section' },
      { key: 'decks', title: 'Колоды', items: by(decks, (d) => d.deleted && !sections[d.section_id]?.deleted), kind: 'deck' },
      { key: 'notes', title: 'Карточки', items: by(notes, (n) => n.deleted && !decks[n.deck_id]?.deleted).slice(0, 150), kind: 'note' },
    ].filter((g) => g.items.length)
  }, [habits, sections, decks, notes])

  function restore(kind, x) {
    if (kind === 'habit') patch('habits', x.id, { deleted: false })
    else if (kind === 'habit-archive') patch('habits', x.id, { archived: false })
    else if (kind === 'section') restoreSection(x)
    else if (kind === 'deck') restoreDeck(x)
    else restoreNote(x)
    toast('Восстановлено')
  }

  return (
    <div className="screen">
      <TopBar title="Корзина и архив" fallback="/settings" />
      {groups.length === 0 ? (
        <motion.div className="card empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={liquid}>
          <div className="big">🫙</div>
          <h3>Пусто</h3>
          <p className="muted" style={{ margin: 0 }}>
            Всё, что удалишь или отправишь в архив, появится здесь — и его можно будет вернуть.
          </p>
        </motion.div>
      ) : (
        groups.map((g, gi) => (
          <div key={g.key}>
            <div className="section-label">
              <span className="mono-label">
                {g.title} · {g.items.length}
              </span>
            </div>
            <motion.div className="card" style={{ overflow: 'hidden' }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...liquid, delay: gi * 0.05 }}>
              <AnimatePresence initial={false}>
                {g.items.map((x) => (
                  <motion.div key={x.id} className="list-item" layout exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }} transition={liquid}>
                    {g.kind.startsWith('habit') ? (
                      <div className="ico-sq sm" style={{ '--c': x.color }}>
                        <HabitIcon name={x.icon} size={18} />
                      </div>
                    ) : g.kind === 'section' ? (
                      <div className="ico-sq sm" style={{ '--c': '#8487f5' }}>
                        {x.emoji}
                      </div>
                    ) : null}
                    <div className="main">
                      <div className="t">{g.kind === 'note' ? plain(x.front, 80) : x.name}</div>
                      <div className="s">
                        {g.kind === 'note' ? `${decks[x.deck_id]?.name || ''} · ` : ''}
                        {g.kind === 'habit-archive' ? 'в архиве' : 'удалено'} {ago(x.updated_at)}
                      </div>
                    </div>
                    <motion.button className="btn secondary sm" whileTap={{ scale: 0.92 }} onClick={() => restore(g.kind, x)}>
                      {g.kind === 'habit-archive' ? <Archive size={15} /> : <RotateCcw size={15} />} Вернуть
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        ))
      )}
    </div>
  )
}
