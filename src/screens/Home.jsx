import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Play, Trophy, Rocket } from 'lucide-react'
import { useStore } from '../lib/store'
import { useStreak, useToday, useSectionStreaks, useQueueState, useDue, useComposition, CATEGORIES } from '../lib/hooks'
import { buildQueue } from '../lib/queue'
import { go } from '../lib/ui'
import { color } from '../lib/palette'
import { dayKey, fmtDay, plural } from '../lib/day'
import { Ring, Flame, Counter } from '../components/ui'
import { liquid } from '../components/fluid'
import { SectionEditor } from '../components/Editors'
import { CategorySheet } from './Section'
import { CreateSheet } from '../components/Create'
import GoSheet from '../components/GoSheet'

// Сколько секунд в среднем уходит на карточку — по последним ответам
export function useSecondsPerCard() {
  const reviews = useStore((s) => s.reviews)
  return useMemo(() => {
    const recent = Object.values(reviews)
      .sort((a, b) => b.reviewed_at - a.reviewed_at)
      .slice(0, 200)
      .map((r) => Math.min(r.ms, 90000))
    if (recent.length < 10) return 15
    return Math.max(5, recent.reduce((a, b) => a + b, 0) / recent.length / 1000)
  }, [reviews])
}

const mins = (cards, spc) => Math.max(1, Math.round((cards * spc) / 60))

export default function Home() {
  const sections = useStore((s) => s.sections)
  const st = useQueueState()
  const streak = useStreak()
  const today = useToday()
  const spc = useSecondsPerCard()
  const [newSection, setNewSection] = useState(false)
  const [create, setCreate] = useState(false)
  const [goOpen, setGoOpen] = useState(false)
  const [pile, setPile] = useState(null) // { cat, ids } — открытая кучка
  const live = useMemo(() => Object.values(sections).filter((s) => !s.deleted).sort((a, b) => a.sort - b.sort), [sections])

  // План: по каждому разделу — сколько к повторению и сколько новых
  const plan = useMemo(() => {
    const rows = live.map((s) => {
      const { counts } = buildQueue({ ...st, scope: { sectionId: s.id } })
      return { s, due: counts.due, fresh: counts.fresh, total: counts.due + counts.fresh }
    })
    return { rows: rows.filter((r) => r.total), total: rows.reduce((a, r) => a + r.total, 0) }
  }, [live, st])

  return (
    <div className="screen">
      <motion.div className="head" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={liquid}>
        <div className="grow">
          <div className="mono-label">Quizly · {fmtDay(dayKey())}</div>
          <h1 className="title" style={{ margin: '4px 0 0' }}>
            Карточки
          </h1>
        </div>
        <motion.button className="round" whileTap={{ scale: 0.88 }} onClick={() => go('/achievements')} aria-label="Достижения">
          <Trophy size={20} />
        </motion.button>
        <motion.button className="round accent" whileTap={{ scale: 0.88 }} onClick={() => setCreate(true)} aria-label="Создать">
          <Plus size={22} strokeWidth={2.4} />
        </motion.button>
      </motion.div>

      {/* Итог дня без целей: кольцо — сколько из сегодняшней очереди уже пройдено */}
      <motion.div className="tint-card" style={{ '--c': '#7c7eff', padding: 20 }} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={liquid}>
        <div className="hero-grid">
          <Ring value={today.n + plan.total ? today.n / (today.n + plan.total) : 0} size={116} stroke={11}>
            <div>
              <b>
                <Counter value={today.n} />
              </b>
              <small>сегодня</small>
            </div>
          </Ring>
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 6, marginBottom: 2 }}>
              <Flame size={18} active={streak.current > 0} animated={streak.todayDone} />
              <span style={{ fontWeight: 700 }}>
                {streak.current} {plural(streak.current, 'день', 'дня', 'дней')}
              </span>
              <span className="faint small">{streak.todayDone ? '· сегодня уже был' : ''}</span>
            </div>
            {plan.total > 0 ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 760, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                  {plan.total} {plural(plan.total, 'карточка', 'карточки', 'карточек')}
                </div>
                <div className="small muted">
                  ≈ {mins(plan.total, spc)} мин · {plan.rows.length} {plural(plan.rows.length, 'раздел', 'раздела', 'разделов')}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 20, fontWeight: 740, lineHeight: 1.2 }}>{live.length ? 'Всё повторено' : 'Пока пусто'}</div>
                <div className="small muted">{live.length ? 'Новые повторения появятся завтра' : 'Создай раздел или импортируй колоду'}</div>
              </>
            )}
          </div>
        </div>
        {live.length > 0 && (
          <div className="row" style={{ marginTop: 18, gap: 10 }}>
            <motion.button className="btn primary shine" style={{ flex: 1, flexDirection: 'column', height: 58, gap: 0 }} whileTap={{ scale: 0.97 }} onClick={() => setGoOpen(true)}>
              <span className="row" style={{ gap: 8 }}>
                <Rocket size={17} /> Погнали
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>случайные из всех разделов</span>
            </motion.button>
            {plan.total > 0 && (
              <motion.button className="btn secondary" style={{ flexDirection: 'column', height: 58, gap: 0, padding: '0 16px' }} whileTap={{ scale: 0.97 }} onClick={() => go('/study/all')}>
                <span className="row" style={{ gap: 6 }}>
                  <Play size={14} fill="currentColor" /> {plan.total}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7 }}>по плану</span>
              </motion.button>
            )}
          </div>
        )}
        {!live.length && (
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn primary" style={{ flex: 1 }} onClick={() => setNewSection(true)}>
              Создать раздел
            </button>
            <button className="btn secondary" onClick={() => go('/import')}>
              Импорт
            </button>
          </div>
        )}
      </motion.div>

      <PilesCard onPick={setPile} />

      {plan.rows.length > 0 && (
        <>
          <div className="section-label">
            <span className="mono-label">План на сегодня</span>
          </div>
          <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...liquid, delay: 0.06 }} style={{ overflow: 'hidden' }}>
            {plan.rows.map(({ s, due, fresh, total }) => {
              const c = color(s.color)
              return (
                <motion.button key={s.id} className="plan-row press" onClick={() => go(`/study/s:${s.id}`)}>
                  <div className="ico-sq sm" style={{ '--c': c.from }}>
                    {s.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 680 }}>{s.name}</div>
                    <div className="small muted">
                      {[due && `${due} повторить`, fresh && `${fresh} ${plural(fresh, 'новая', 'новые', 'новых')}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className="mono-label" style={{ fontSize: 11 }}>
                    ~{mins(total, spc)} мин
                  </span>
                  <span className="play" style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})`, '--c': c.from }}>
                    <Play size={16} fill="currentColor" />
                  </span>
                </motion.button>
              )
            })}
          </motion.div>
        </>
      )}

      {live.length > 0 && (
        <>
          <div className="section-label">
            <span className="mono-label">Разделы</span>
            <button onClick={() => setNewSection(true)}>+ Раздел</button>
          </div>
          <div className="col" style={{ gap: 12 }}>
            {live.map((s, i) => (
              <SectionCard key={s.id} section={s} i={i} />
            ))}
          </div>
        </>
      )}

      <SectionEditor open={newSection} onClose={() => setNewSection(false)} />
      <CreateSheet open={create} onClose={() => setCreate(false)} onNewSection={() => setNewSection(true)} />
      <GoSheet open={goOpen} onClose={() => setGoOpen(false)} scope="all" />
      <CategorySheet cat={pile?.cat || null} ids={pile?.ids || []} onClose={() => setPile(null)} />
    </div>
  )
}

// Две общие кучки по всем разделам: «Не знаю» и «Знаю». Нажал — список карточек и кнопка «Повторить эти»
function PilesCard({ onPick }) {
  const decks = useStore((s) => s.decks)
  const ids = useMemo(() => Object.values(decks).filter((d) => !d.deleted).map((d) => d.id), [decks])
  const comp = useComposition(ids)
  if (!comp.total) return null
  const tile = (k, label, hint) => (
    <motion.button className={`pile-tile ${k}`} whileTap={{ scale: 0.96 }} disabled={!comp[k]} onClick={() => onPick({ cat: k, ids: comp.ids[k] })}>
      <b className="tnum">{comp[k]}</b>
      <span>{label}</span>
      <small>{hint}</small>
    </motion.button>
  )
  return (
    <>
      <div className="section-label">
        <span className="mono-label">Мои кучки</span>
        {comp.todo > 0 && <span className="small faint">ещё не проходил: {comp.todo}</span>}
      </div>
      <motion.div className="piles-home" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...liquid, delay: 0.04 }}>
        {tile('unknown', 'Не знаю', 'повторить эти')}
        {tile('known', 'Знаю', 'освежить')}
      </motion.div>
    </>
  )
}

// Карточка раздела: градиентная плашка, кольцо «выучено», полоса состава, колоды и кнопка «Учить»
function SectionCard({ section, i }) {
  const decks = useStore((s) => s.decks)
  const streaks = useSectionStreaks()
  const due = useDue({ sectionId: section.id })
  const st = streaks[section.id]
  const c = color(section.color)

  const deckList = useMemo(
    () =>
      Object.values(decks)
        .filter((d) => d.section_id === section.id && !d.deleted)
        .sort((a, b) => a.sort - b.sort),
    [decks, section.id],
  )
  const comp = useComposition(deckList.map((d) => d.id))

  // Кольцо — доля карточек из кучки «Знаю»
  const pct = comp.total ? Math.round((comp.known / comp.total) * 100) : 0
  const parts = CATEGORIES

  return (
    <motion.div
      className="tint-card section-v2 press"
      style={{ '--c': c.from, '--c2': c.to }}
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...liquid, delay: 0.08 + i * 0.05 }}
      onClick={() => go(`/s/${section.id}`)}
    >
      <div className="sv2-watermark" aria-hidden="true">
        {section.emoji || '📚'}
      </div>

      <div className="sv2-top">
        <div className="sv2-emoji">{section.emoji || '📚'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{section.name}</h3>
          <div className="desc">
            {deckList.length} {plural(deckList.length, 'колода', 'колоды', 'колод')} · {comp.total} {plural(comp.total, 'карточка', 'карточки', 'карточек')}
          </div>
        </div>
        <Ring value={pct / 100} size={54} stroke={5} from={c.from} to={c.to}>
          <span className="sv2-pct">{pct}%</span>
        </Ring>
      </div>

      <div className="sv2-bar">
        {parts.map((p) =>
          comp[p.k] ? <motion.i key={p.k} style={{ background: p.color }} initial={{ flexGrow: 0 }} animate={{ flexGrow: comp[p.k] }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} /> : null,
        )}
        {!comp.total && <i style={{ flexGrow: 1 }} />}
      </div>
      <div className="sv2-legend mono-label">
        <span style={{ color: comp.unknown ? 'var(--again)' : undefined }}>не знаю {comp.unknown}</span>
        <span style={{ color: comp.known ? 'var(--good)' : undefined }}>знаю {comp.known}</span>
        <span>не пройдено {comp.todo}</span>
      </div>

      <div className="sv2-bottom">
        <div className="sv2-decks">
          {deckList.slice(0, 3).map((d) => (
            <span key={d.id} className="sv2-deck">
              {d.kind === 'vocab' ? '🔤' : '💬'} {d.name}
            </span>
          ))}
          {deckList.length > 3 && <span className="sv2-deck">+{deckList.length - 3}</span>}
          {!deckList.length && <span className="small faint">Пока нет колод</span>}
        </div>
        {st?.current > 0 && (
          <span className="chip" style={{ gap: 4, flexShrink: 0 }}>
            <Flame size={13} animated={false} active={st.todayDone} /> {st.current}
          </span>
        )}
        {due.total > 0 ? (
          <motion.button
            className="sv2-study"
            whileTap={{ scale: 0.92 }}
            onClick={(e) => {
              e.stopPropagation()
              go(`/study/s:${section.id}`)
            }}
          >
            <Play size={13} fill="currentColor" /> {due.total}
          </motion.button>
        ) : comp.total ? (
          <span className="sv2-done">✓</span>
        ) : null}
      </div>
    </motion.div>
  )
}
