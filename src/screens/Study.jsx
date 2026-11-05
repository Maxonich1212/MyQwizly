import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { getState, patch, upsert, uid, useStore } from '../lib/store'
import { buildQueue, randomQueue, scopeDecks } from '../lib/queue'
import { gradeNote, previewIntervals, fmtInterval, Rating } from '../lib/srs'
import { checkVocab, keywordCoverage, stripHtml, diffMarks } from '../lib/check'
import { renderContent } from '../lib/render'
import { hydrateMedia } from '../lib/media'
import { speak, canSpeak, englishSide } from '../lib/tts'
import { dayKey, fmtMinutes, plural } from '../lib/day'
import { aggregate, globalStreak } from '../lib/stats'
import { gradient } from '../lib/palette'
import { back, haptic } from '../lib/ui'
import Icon from '../components/Icon'
import { Flame, Ring, Counter, soft, spring } from '../components/ui'
import { NoteEditor } from '../components/Editors'
import Transcription from '../components/Transcription'
import { playSound, soundFor } from '../lib/sfx'

function parseScope(s) {
  if (s.startsWith('s:')) return { sectionId: s.slice(2) }
  if (s.startsWith('d:')) return { deckId: s.slice(2) }
  return { all: true }
}

const RATINGS = [
  { r: Rating.Again, label: 'Снова', key: '1' },
  { r: Rating.Hard, label: 'Трудно', key: '2' },
  { r: Rating.Good, label: 'Хорошо', key: '3' },
  { r: Rating.Easy, label: 'Легко', key: '4' },
]

// study/<scope> — по расписанию; cram:<scope> — прогон; go:<n>:<scope> — n случайных («Погнали»);
// go:<n>:ids — n случайных из списка, сохранённого в sessionStorage (например, «ошибки»)
export default function Study({ scope }) {
  if (scope.startsWith('cram:')) return <Cram scope={parseScope(scope.slice(5))} />
  if (scope.startsWith('go:')) {
    const [, n, ...rest] = scope.split(':')
    const target = rest.join(':')
    return <Learn scope={target === 'ids' ? 'all' : target} goCount={Number(n) || 10} goIds={target === 'ids'} />
  }
  return <Learn scope={scope} />
}

function Learn({ scope: scopeStr, goCount, goIds }) {
  const scope = useMemo(() => parseScope(scopeStr), [scopeStr])
  const settings = useStore((s) => s.settings)
  const notes = useStore((s) => s.notes)
  const decks = useStore((s) => s.decks)
  const sections = useStore((s) => s.sections)

  // Очередь снимаем один раз при входе — дальше управляем ей сами
  // Первая карточка берётся внутри того же инициализатора: он должен быть чистым (StrictMode вызывает его дважды)
  const [session] = useState(() => {
    const st = getState()
    let ids = null
    if (goIds) {
      try {
        ids = JSON.parse(sessionStorage.getItem('mq-go-ids') || '[]')
      } catch {
        ids = []
      }
    }
    const { queue, later } = goCount ? randomQueue(st, scope, goCount, ids) : buildQueue({ ...st, scope })
    const s = { queue: [...queue], later: [...later], total: queue.length + later.length }
    s.first = takeNext(s)
    return s
  })
  const [current, setCurrent] = useState(session.first)
  const [revealed, setRevealed] = useState(false)
  const [input, setInput] = useState('')
  const [unknown, setUnknown] = useState(false) // нажал «Не знаю» — ответ раскрыт без проверки
  const [swipeHint, setSwipeHint] = useState(() => !localStorage.getItem('mq-swiped'))
  const tall = useTall(revealed, `${current?.note}${current?.dir}`)
  const [exitKind, setExitKind] = useState({ type: 'next', rating: 3 })
  const [stats, setStats] = useState({ done: 0, correct: 0, ms: 0 })
  const [celebrate, setCelebrate] = useState(null)
  const [editing, setEditing] = useState(false)
  const shownAt = useRef(Date.now())
  const startedAt = useRef(Date.now())

  const note = current ? notes[current.note] : null
  const deck = note ? decks[note.deck_id] : null
  const section = deck ? sections[deck.section_id] : null
  const vocab = deck?.kind === 'vocab'
  const dir = current?.dir
  // Для словарей: fwd — видим английское, rev — русское
  const question = note ? (dir === 'rev' ? note.back : note.front) : ''
  const answer = note ? (dir === 'rev' ? note.front : note.back) : ''
  const english = note ? englishSide(note.front, note.back) : null

  const verdict = useMemo(() => {
    if (!revealed || !note || !input.trim()) return null
    if (vocab) return { kind: 'vocab', ...checkVocab(input, answer) }
    return { kind: 'qa', ...keywordCoverage(input, answer) }
  }, [revealed, note, input, vocab, answer])

  const suggested = useMemo(() => {
    if (unknown) return Rating.Again
    if (!verdict) return null
    if (verdict.kind === 'vocab') return verdict.verdict === 'exact' ? Rating.Good : verdict.verdict === 'close' ? Rating.Hard : Rating.Again
    return verdict.ratio >= 0.7 ? Rating.Good : verdict.ratio >= 0.4 ? Rating.Hard : Rating.Again
  }, [verdict, unknown])

  const intervals = useMemo(() => (note && revealed ? previewIntervals(note, dir, settings.retention) : null), [note, dir, revealed, settings.retention])

  // Автоозвучка английского слова, когда оно на экране
  useEffect(() => {
    if (!vocab || !settings.autoSpeak || !english || !note) return
    const showsEnglish = (!revealed && dir === 'fwd') || (revealed && dir === 'rev')
    if (showsEnglish) speak(english)
  }, [vocab, settings.autoSpeak, english, note?.id, dir, revealed]) // eslint-disable-line

  // Звук уже прозвучал для этой карточки (слово проверено при вводе) — на оценке второй раз не играем
  const sounded = useRef(false)

  const reveal = useCallback(
    (dontKnow = false) => {
      if (!current || revealed) return
      setExitKind({ type: 'flip' })
      setUnknown(dontKnow === true)
      setRevealed(true)
      haptic(6)
      // Введённое слово проверяется сразу — сразу и звук: верно / почти / мимо
      if (dontKnow !== true && vocab && input.trim()) {
        const v = checkVocab(input, answer).verdict
        playSound(v === 'exact' ? 'ok' : v === 'close' ? 'meh' : 'bad')
        sounded.current = true
      }
    },
    [current, revealed, vocab, input, answer],
  )

  const grade = useCallback(
    (rating) => {
      if (!current || !revealed) return
      const st = getState()
      const n = st.notes[current.note]
      const d = st.decks[n.deck_id]
      const now = new Date()
      const before = aggregate(st.reviews)[dayKey()]?.n || 0
      const g = gradeNote(n, current.dir, rating, st.settings.retention, now)
      const ms = Date.now() - shownAt.current
      patch('notes', n.id, { srs: g.srs })
      upsert('reviews', {
        id: uid(),
        note_id: n.id,
        deck_id: d.id,
        section_id: d.section_id,
        dir: current.dir,
        rating,
        state: g.prevState,
        ms,
        day: dayKey(),
        reviewed_at: +now,
      })
      // Карточка не возвращается в эту же сессию — расписание само покажет её позже.
      // Раньше «Снова/Трудно» и даже «Хорошо» на новой карточке ставили её обратно в очередь на 1–10 минут,
      // и 20 выбранных карточек превращались в 40+
      setStats((s) => ({ done: s.done + 1, correct: s.correct + (rating > 1 ? 1 : 0), ms: s.ms + Math.min(ms, 120000) }))
      haptic(rating === 1 ? [10, 40, 10] : 10)
      if (!sounded.current) playSound(soundFor(rating))
      sounded.current = false

      // Первая карточка за день продлевает серию — коротко празднуем
      if (before === 0) {
        const s2 = getState()
        setCelebrate(globalStreak(aggregate(s2.reviews), s2.settings).current)
      }

      setExitKind({ type: 'next', rating })
      setRevealed(false)
      setInput('')
      setUnknown(false)
      setCurrent(takeNext(session))
      shownAt.current = Date.now()
    },
    [current, revealed, session],
  )

  // Клавиатура: пробел/Enter — показать ответ, 1–4 — оценка
  useEffect(() => {
    function on(e) {
      if (editing) return
      const typing = e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT'
      if (!revealed) {
        if ((e.key === 'Enter' && (!typing || e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey)) || (e.key === ' ' && !typing)) {
          e.preventDefault()
          reveal()
        }
        return
      }
      if (typing) return
      const r = RATINGS.find((x) => x.key === e.key)
      if (r) grade(r.r)
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        grade(suggested || Rating.Good)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [revealed, reveal, grade, suggested, editing])

  // Карточку удалили (здесь или на другом устройстве) — просто идём дальше
  useEffect(() => {
    if (current && (!note || note.deleted)) setCurrent(takeNext(session))
  }, [current, note, session])

  const done = stats.done
  const left = (current ? 1 : 0) + session.queue.length + session.later.length
  const progress = done / Math.max(1, done + left)

  if (!current) return <Finished stats={stats} startedAt={startedAt.current} empty={session.total === 0} />
  if (!note || note.deleted) return null

  const accent = section ? gradient(section.color, 90) : undefined

  return (
    <div className="study app">
      <div className="row" style={{ gap: 12 }}>
        <button className="icon-btn ghost" onClick={() => back()} aria-label="Закончить">
          <Icon name="close" />
        </button>
        <div className="study-progress">
          <motion.i style={{ background: accent }} initial={{ width: '3%' }} animate={{ width: `${Math.max(3, progress * 100)}%` }} transition={soft} />
        </div>
        <span className="small faint tnum" style={{ minWidth: 44, textAlign: 'right', fontWeight: 600 }}>
          {done}/{done + left}
        </span>
      </div>

      <div className="stage">
        <AnimatePresence mode="wait" custom={exitKind} initial={false}>
          <CardFace
            key={`${current.note}-${current.dir}-${revealed ? 'b' : 'f'}`}
            exitKind={exitKind}
            accent={accent}
            onSwipe={
              revealed
                ? (r) => {
                    localStorage.setItem('mq-swiped', '1')
                    setSwipeHint(false)
                    grade(r)
                  }
                : null
            }
            tall={tall}
            swipe={
              intervals && {
                left: { icon: 'close', label: 'Не знаю', sub: `покажу через ${fmtInterval(intervals[Rating.Again])}` },
                right: { icon: 'clock', label: 'Повторить позже', sub: `через ${fmtInterval(intervals[Rating.Good])}` },
                up: { icon: 'check', label: 'Выучил', sub: `теперь через ${fmtInterval(intervals[Rating.Easy])}` },
              }
            }
          >
            <div className="kicker">
              <span>{section?.emoji}</span>
              <span>{deck?.name}</span>
              <span className="spacer" />
              {current.isNew && !revealed && <span className="chip accent">новая</span>}
              {vocab && <span className="chip">{dir === 'rev' ? 'RU → EN' : 'EN → RU'}</span>}
              <button className="icon-btn ghost" style={{ width: 30, height: 30 }} onClick={() => setEditing(true)} aria-label="Редактировать">
                <Icon name="edit" size={16} />
              </button>
            </div>

            {!revealed ? (
              <Front
                vocab={vocab}
                dir={dir}
                note={note}
                question={question}
                english={english}
                input={input}
                setInput={setInput}
                onSubmit={reveal}
              />
            ) : (
              <Back vocab={vocab} dir={dir} note={note} question={question} answer={answer} english={english} input={input} verdict={verdict} unknown={unknown} />
            )}
          </CardFace>
        </AnimatePresence>
      </div>

      <div className="study-actions">
        <AnimatePresence mode="wait" initial={false}>
          {!revealed ? (
            <motion.div key="show" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.18 }}>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn secondary dk-btn" onClick={() => reveal(true)}>
                  Не знаю
                </button>
                <button className="btn primary" style={{ flex: 1, ...(accent ? { background: accent } : {}) }} onClick={() => reveal()}>
                  {input.trim() ? 'Проверить' : 'Показать ответ'}
                </button>
              </div>
              <div className="small faint" style={{ textAlign: 'center', marginTop: 8 }}>
                {vocab ? 'Напиши перевод — после проверки увидишь свой ответ рядом с правильным' : 'Ответь своими словами — после проверки сверишь с эталоном'}
              </div>
            </motion.div>
          ) : (
            <motion.div key="rate" initial="h" animate="s" exit={{ opacity: 0, y: 10, transition: { duration: 0.12 } }} variants={{ s: { transition: { staggerChildren: 0.035 } } }}>
              {swipeHint && (
                <div className="swipe-hint">
                  <div>
                    <span>← Не знаю</span>
                    {!tall && <span className="up">↑ Выучил</span>}
                    <span>Позже →</span>
                  </div>
                  <i>{tall ? 'ответ длинный — оцени кнопками ниже' : 'свайп только ставит оценку — ничего не удаляется'}</i>
                </div>
              )}
              <div className="rate">
              {RATINGS.map((x) => (
                <motion.button
                  key={x.r}
                  className={`r${x.r} ${suggested === x.r ? 'suggest' : ''}`}
                  onClick={() => grade(x.r)}
                  variants={{ h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0, transition: spring } }}
                  whileTap={{ scale: 0.92 }}
                >
                  {x.label}
                  <small>{intervals ? fmtInterval(intervals[x.r]) : ''}</small>
                </motion.button>
              ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>{celebrate != null && <Celebrate streak={celebrate} onClose={() => setCelebrate(null)} />}</AnimatePresence>
      <NoteEditor open={editing} onClose={() => setEditing(false)} deck={deck} note={note} />
    </div>
  )
}

function takeNext(session) {
  const now = Date.now()
  if (session.later.length && session.later[0].due <= now) return session.later.shift()
  if (session.queue.length) return session.queue.shift()
  if (session.later.length) return session.later.shift()
  return null
}

const faceVariants = {
  enter: (k) => (k.type === 'flip' ? { rotateY: -90, opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: 0, y: 24, scale: 0.94, rotateY: 0 }),
  center: { rotateY: 0, opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 },
  exit: (k) =>
    k.type === 'flip'
      ? { rotateY: 90, transition: { duration: 0.16, ease: 'easeIn' } }
      : k.rating === 4
        ? { opacity: 0, y: -190, scale: 0.94, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }
        : { opacity: 0, x: k.rating === 1 ? -140 : 140, rotate: k.rating === 1 ? -6 : 6, scale: 0.96, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } },
}

// Влезает ли ответ на экран. Если нет — вертикальный жест нужен для прокрутки, и свайп вверх отключается
function useTall(active, dep) {
  const [tall, setTall] = useState(false)
  useEffect(() => {
    if (!active) {
      setTall(false)
      return
    }
    // Страница больше не прокручивается — «длинным» считаем ответ, который не влез в саму карточку
    // (она тогда листается внутри себя, и вертикальный жест нужен ей)
    const check = () => {
      const f = document.querySelector('.stage .face')
      setTall(!!f && f.scrollHeight - f.clientHeight > 4)
    }
    const t = setTimeout(check, 450)
    const face = document.querySelector('.stage .face')
    const ro = new ResizeObserver(check)
    if (face) ro.observe(face)
    return () => {
      clearTimeout(t)
      ro.disconnect()
    }
  }, [active, dep])
  return tall
}

function CardFace({ children, exitKind, accent, onSwipe, swipe, tall = false }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const canUp = !!swipe?.up && !tall
  const blue = useTransform(y, [-140, -20], [0.9, 0])
  const upOp = useTransform(y, [-120, -25], [1, 0])
  const upScale = useTransform(y, [-130, -60], [1.06, 0.85])
  const rotate = useTransform(x, [-220, 220], [-7, 7])
  const red = useTransform(x, [-140, -20], [0.9, 0])
  const green = useTransform(x, [20, 140], [0, 0.9])
  // Штамп с названием действия проявляется по мере движения и «щёлкает» у порога
  const leftOp = useTransform(x, [-120, -25], [1, 0])
  const rightOp = useTransform(x, [25, 120], [0, 1])
  const leftScale = useTransform(x, [-130, -60], [1.06, 0.85])
  const rightScale = useTransform(x, [60, 130], [0.85, 1.06])
  const ref = useRef(null)

  useEffect(() => {
    hydrateMedia(ref.current)
  })

  return (
    <motion.div
      custom={exitKind}
      variants={faceVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={exitKind.type === 'flip' ? { duration: 0.22, ease: 'easeOut' } : soft}
      drag={onSwipe ? (canUp ? true : 'x') : false}
      dragDirectionLock
      dragSnapToOrigin
      dragElastic={0.85}
      onDragEnd={(_, i) => {
        if (!onSwipe) return
        const { x: dx, y: dy } = i.offset
        const { x: vx, y: vy } = i.velocity
        // Вверх — только если жест заметно вертикальный
        if (canUp && Math.abs(dy) > Math.abs(dx) && (dy < -110 || vy < -700)) onSwipe(Rating.Easy)
        else if (dx < -120 || vx < -800) onSwipe(Rating.Again)
        else if (dx > 120 || vx > 800) onSwipe(Rating.Good)
      }}
      style={{ x, y, rotate, position: 'relative', touchAction: onSwipe ? (canUp ? 'none' : 'pan-y') : 'auto' }}
    >
      <div className="face" ref={ref}>
        {accent && <div className="accent-bar" style={{ background: accent }} />}
        {children}
      </div>
      {onSwipe && (
        <>
          <motion.div style={{ opacity: red, position: 'absolute', inset: 0, borderRadius: 28, boxShadow: 'inset 0 0 0 3px var(--again)', background: 'color-mix(in srgb, var(--again) 10%, transparent)', pointerEvents: 'none' }} />
          <motion.div style={{ opacity: green, position: 'absolute', inset: 0, borderRadius: 28, boxShadow: 'inset 0 0 0 3px var(--good)', background: 'color-mix(in srgb, var(--good) 10%, transparent)', pointerEvents: 'none' }} />
          {canUp && <motion.div style={{ opacity: blue, position: 'absolute', inset: 0, borderRadius: 28, boxShadow: 'inset 0 0 0 3px var(--easy)', background: 'color-mix(in srgb, var(--easy) 10%, transparent)', pointerEvents: 'none' }} />}
          {swipe && (
            <>
              {canUp && (
                <motion.div className="swipe-stamp easy" style={{ opacity: upOp, scale: upScale }}>
                  <Icon name={swipe.up.icon} size={20} stroke={3} />
                  <div>
                    <b>{swipe.up.label}</b>
                    <small>{swipe.up.sub}</small>
                  </div>
                </motion.div>
              )}
              <motion.div className="swipe-stamp again" style={{ opacity: leftOp, scale: leftScale }}>
                <Icon name={swipe.left.icon} size={20} stroke={3} />
                <div>
                  <b>{swipe.left.label}</b>
                  <small>{swipe.left.sub}</small>
                </div>
              </motion.div>
              <motion.div className="swipe-stamp good" style={{ opacity: rightOp, scale: rightScale }}>
                <Icon name={swipe.right.icon} size={20} stroke={3} />
                <div>
                  <b>{swipe.right.label}</b>
                  <small>{swipe.right.sub}</small>
                </div>
              </motion.div>
            </>
          )}
        </>
      )}
    </motion.div>
  )
}

function Content({ text, format, className = 'content' }) {
  const html = useMemo(() => renderContent(text, format), [text, format])
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

function SpeakBtn({ text }) {
  if (!canSpeak() || !text) return null
  return (
    <motion.button className="speak" whileTap={{ scale: 0.85 }} onClick={() => speak(text)} aria-label="Произнести">
      <Icon name="speaker" size={20} />
    </motion.button>
  )
}

function Front({ vocab, dir, note, question, english, input, setInput, onSubmit }) {
  const ref = useRef(null)
  useEffect(() => {
    // На телефоне не открываем клавиатуру сама — пусть сначала прочитает вопрос
    if (vocab && matchMedia('(pointer: fine)').matches) ref.current?.focus()
  }, [vocab])

  if (vocab) {
    return (
      <>
        <div className="q-text word" style={{ minHeight: 120 }}>
          <Content text={question} format={note.format} className="" />
          {dir === 'fwd' && (
            <Transcription ipa={note.extra?.transcription}>
              <SpeakBtn text={english} />
            </Transcription>
          )}
        </div>
        <input
          ref={ref}
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={dir === 'rev' ? 'По-английски…' : 'Перевод…'}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          lang={dir === 'rev' ? 'en' : 'ru'}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onSubmit())}
          style={{ textAlign: 'center', marginTop: 16 }}
        />
      </>
    )
  }
  return (
    <>
      <div className="q-text">
        <Content text={question} format={note.format} />
      </div>
      <div className="answer-box">
        <textarea
          ref={ref}
          className="textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Твой ответ… (⌘ + Enter — проверить)"
        />
      </div>
    </>
  )
}

// «Твой ответ»: показывается всегда — введённый текст (с подсветкой несовпавших букв для слов)
// либо пометка, что ответа не было. Так можно сверить своё с правильным, а не только прочитать эталон
function MyAnswer({ input, unknown, marks, big, missing }) {
  const typed = input.trim()
  return (
    <div className={`mine ${typed ? '' : 'none'}`}>
      <div className="mine-label">{unknown && !typed ? 'ТЫ ОТМЕТИЛ' : 'ТВОЙ ОТВЕТ'}</div>
      {typed ? (
        <div className={`mine-text ${big ? 'big' : ''}`}>
          {marks ? marks.map((m, i) => (m.ok ? <span key={i}>{m.ch}</span> : <span key={i} className="bad">{m.ch}</span>)) : input}
        </div>
      ) : (
        <div className="mine-text faintly">{unknown ? '«Не знаю»' : 'Ответ не вводился'}</div>
      )}
      {missing && <div className="mine-missing">не хватило: {missing}</div>}
    </div>
  )
}

function Back({ vocab, dir, note, question, answer, english, input, verdict, unknown = false, compare = true }) {
  if (vocab) {
    const typed = input.trim()
    // Для подсветки сравниваем ввод с ближайшим вариантом перевода
    const marks = typed && verdict?.best ? diffMarks(typed, verdict.best) : null
    // Буквы правильного слова, которых нет в моём ответе (пропустил букву — это видно лучше, чем красные буквы)
    const missingChars = typed && verdict?.best && verdict.verdict !== 'exact' ? diffMarks(verdict.best, typed).filter((m) => !m.ok && m.ch.trim()).map((m) => m.ch) : []
    const missing = missingChars.length && missingChars.length <= 4 ? missingChars.map((c) => `«${c}»`).join(' ') : null
    const status = unknown && !typed ? null : verdict
    return (
      <div style={{ textAlign: 'center' }}>
        {status && (
          <motion.div className={`verdict ${status.verdict}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} style={{ justifyContent: 'center' }}>
            <Icon name={status.verdict === 'wrong' ? 'close' : 'check'} size={18} stroke={2.6} />
            {status.verdict === 'exact' ? 'Верно!' : status.verdict === 'close' ? 'Почти — опечатка' : 'Не совпало'}
          </motion.div>
        )}
        <div className="faint" style={{ fontSize: 16 }}>
          <Content text={question} format={note.format} className="" />
        </div>
        {compare && <MyAnswer input={input} unknown={unknown} marks={marks} big missing={missing} />}
        {compare && (
          <div className="mine-label" style={{ marginTop: 10 }}>
            ПРАВИЛЬНО
          </div>
        )}
        <div className="q-text word compact" style={{ minHeight: 0, margin: '2px 0 0' }}>
          <Content text={answer} format={note.format} className="" />
        </div>
        <Transcription ipa={note.extra?.transcription}>
          <SpeakBtn text={english} />
        </Transcription>
        {note.extra?.example && (
          <div className="example">
            <Content text={note.extra.example} format={note.format} className="" />
          </div>
        )}
        {note.extra?.more && (
          <div className="content small muted" style={{ marginTop: 12 }}>
            <Content text={note.extra.more} format={note.format} />
          </div>
        )}
      </div>
    )
  }
  const typed = input.trim()
  return (
    <>
      <div className="muted" style={{ fontWeight: 650, marginBottom: 12, fontSize: 15 }}>
        <Content text={question} format={note.format} />
      </div>
      {compare && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={soft}>
          <MyAnswer input={input} unknown={unknown} />
          {typed && verdict && (
            <div className="coverage">
              <span>Совпало ключевых слов: {Math.round(verdict.ratio * 100)}%</span>
              {verdict.hits.length + verdict.misses.length > 0 && (
                <div className="kw">
                  {verdict.hits.map((w) => (
                    <span key={w} className="hit">
                      {w}
                    </span>
                  ))}
                  {verdict.misses.map((w) => (
                    <span key={w} className="miss">
                      {w}
                    </span>
                  ))}
                </div>
              )}
              {verdict.misses.length > 0 && <small>Зачёркнутые слова из эталона ты не упомянул</small>}
            </div>
          )}
        </motion.div>
      )}
      <div className="mine-label" style={{ margin: '14px 0 8px' }}>
        ЭТАЛОН
      </div>
      <Content text={answer} format={note.format} />
      {note.extra?.more && (
        <div className="content small muted" style={{ marginTop: 12 }}>
          <Content text={note.extra.more} format={note.format} />
        </div>
      )}
    </>
  )
}

function Finished({ stats, startedAt, empty }) {
  const reviews = useStore((s) => s.reviews)
  const settings = useStore((s) => s.settings)
  const days = useMemo(() => aggregate(reviews), [reviews])
  const streak = useMemo(() => globalStreak(days, settings), [days, settings])
  const today = days[dayKey()]?.n || 0
  const acc = stats.done ? stats.correct / stats.done : 0
  const minutes = fmtMinutes(Math.max(stats.ms, stats.done ? Date.now() - startedAt : 0))

  return (
    <div className="study app" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={soft}>
        {empty ? (
          <>
            <div style={{ fontSize: 64, marginBottom: 10 }}>🌿</div>
            <h1 className="title">Всё повторено</h1>
            <p className="subtitle" style={{ marginBottom: 28 }}>
              Новых и просроченных карточек нет. Возвращайся завтра — или добавь новые.
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <Ring value={acc} size={150} stroke={14} from="#10b981" to="#0ea5e9">
                <div>
                  <b>
                    <Counter value={Math.round(acc * 100)} format={(v) => `${Math.round(v)}%`} />
                  </b>
                  <small>точность</small>
                </div>
              </Ring>
            </div>
            <h1 className="title">Сессия завершена</h1>
            <p className="subtitle">
              {stats.done} {plural(stats.done, 'карточка', 'карточки', 'карточек')} · {minutes}
            </p>
            <div className="card pad row" style={{ margin: '24px 0', justifyContent: 'center', gap: 28 }}>
              <div>
                <div className="row" style={{ justifyContent: 'center', gap: 6, fontSize: 26, fontWeight: 760 }}>
                  <Flame size={26} active={streak.current > 0} />
                  {streak.current}
                </div>
                <div className="small faint">{plural(streak.current, 'день', 'дня', 'дней')} подряд</div>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 760 }} className="tnum">
                  {today}
                </div>
                <div className="small faint">карточек сегодня</div>
              </div>
            </div>
          </>
        )}
        <button className="btn primary block" onClick={() => back()}>
          Готово
        </button>
      </motion.div>
    </div>
  )
}

function Celebrate({ streak, onClose }) {
  useEffect(() => {
    haptic([20, 60, 30])
    const id = setTimeout(onClose, 3200)
    return () => clearTimeout(id)
  }, [onClose])
  const sparks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2
        const d = 120 + Math.random() * 90
        return { x: Math.cos(a) * d, y: Math.sin(a) * d - 40, c: ['#ffb43a', '#ff6a1a', '#a855f7', '#6366f1', '#ec4899'][i % 5], s: 5 + Math.random() * 6 }
      }),
    [],
  )
  return (
    <motion.div className="celebrate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div style={{ position: 'relative' }}>
        {sparks.map((s, i) => (
          <motion.span
            key={i}
            className="spark"
            style={{ background: s.c, width: s.s, height: s.s, left: '50%', top: '40%' }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x: s.x, y: s.y, opacity: 0, scale: 1 }}
            transition={{ duration: 1.3, ease: [0.2, 0.8, 0.3, 1], delay: 0.25 }}
          />
        ))}
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.05 }} style={{ display: 'flex', justifyContent: 'center' }}>
          <Flame size={120} />
        </motion.div>
        <motion.div className="num" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: 0.3 }}>
          <Counter value={streak} />
        </motion.div>
        <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...soft, delay: 0.45 }}>
          <h2 style={{ margin: '8px 0 4px', fontSize: 24 }}>Серия продлена!</h2>
          <p className="muted" style={{ margin: 0 }}>
            {streak} {plural(streak, 'день', 'дня', 'дней')} подряд — так держать
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Прогон перед собеседованием: все карточки вперемешку, «знаю / не знаю», расписание FSRS не трогаем
function Cram({ scope }) {
  const notes = useStore((s) => s.notes)
  const decks = useStore((s) => s.decks)
  const sections = useStore((s) => s.sections)
  const [state] = useState(() => {
    const st = getState()
    const ds = scopeDecks(st.decks, scope)
    const items = []
    for (const n of Object.values(st.notes)) {
      const d = ds.find((x) => x.id === n.deck_id)
      if (!d || n.deleted || n.suspended) continue
      items.push({ note: n.id, dir: d.kind === 'vocab' && Math.random() < 0.5 ? 'rev' : 'fwd', tries: 0 })
    }
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[items[i], items[j]] = [items[j], items[i]]
    }
    return { queue: items, total: items.length, missed: new Set() }
  })
  const [current, setCurrent] = useState(() => state.queue[0] || null)
  const [revealed, setRevealed] = useState(false)
  const [exitKind, setExitKind] = useState({ type: 'next', rating: 3 })
  const [known, setKnown] = useState(0)

  const answer = useCallback(
    (ok) => {
      state.queue.shift()
      if (ok) setKnown((k) => k + 1)
      else {
        state.missed.add(current.note)
        // Не знаю — вернётся ближе к концу, но не больше двух раз
        if (current.tries < 2) state.queue.splice(Math.min(state.queue.length, 4 + Math.floor(Math.random() * 4)), 0, { ...current, tries: current.tries + 1 })
      }
      haptic(ok ? 10 : [10, 40, 10])
      playSound(ok ? 'ok' : 'bad')
      setExitKind({ type: 'next', rating: ok ? 3 : 1 })
      setRevealed(false)
      setCurrent(state.queue[0] || null)
    },
    [current, state],
  )

  useEffect(() => {
    function on(e) {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setExitKind({ type: 'flip' })
        setRevealed(true)
      } else if (revealed && (e.key === '1' || e.key === 'ArrowLeft')) answer(false)
      else if (revealed && (e.key === '2' || e.key === 'ArrowRight' || e.key === ' ')) answer(true)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [revealed, answer])

  if (!current) {
    const missed = [...state.missed].map((id) => notes[id]).filter(Boolean)
    const pct = state.total ? Math.round(((state.total - missed.length) / state.total) * 100) : 0
    return (
      <div className="study app">
        <motion.div style={{ margin: 'auto 0', textAlign: 'center' }} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={soft}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Ring value={pct / 100} size={140} stroke={13} from="#f4c34a" to="#f39a4c">
              <div>
                <b>{pct}%</b>
                <small>с первого раза</small>
              </div>
            </Ring>
          </div>
          <h1 className="title">Прогон завершён</h1>
          <p className="subtitle">
            {state.total} {plural(state.total, 'карточка', 'карточки', 'карточек')} · {missed.length ? `подтянуть ${missed.length}` : 'всё знаешь'}
          </p>
        </motion.div>
        {missed.length > 0 && (
          <div className="card list" style={{ margin: '20px 0', textAlign: 'left' }}>
            {missed.slice(0, 12).map((n) => (
              <div key={n.id} className="list-item">
                <div className="main">
                  <div className="t">{stripHtml(n.front).slice(0, 80)}</div>
                  <div className="s">{stripHtml(n.back).slice(0, 100)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="btn primary block" style={{ marginTop: 'auto' }} onClick={() => back()}>
          Готово
        </button>
      </div>
    )
  }

  const note = notes[current.note]
  if (!note) return null
  const deck = decks[note.deck_id]
  const section = deck ? sections[deck.section_id] : null
  const vocab = deck?.kind === 'vocab'
  const question = current.dir === 'rev' ? note.back : note.front
  const ans = current.dir === 'rev' ? note.front : note.back
  const done = state.total - state.queue.length
  const accent = 'linear-gradient(90deg, #f4c34a, #f39a4c)'

  return (
    <div className="study app">
      <div className="row" style={{ gap: 12 }}>
        <button className="icon-btn ghost" onClick={() => back()} aria-label="Закончить">
          <Icon name="close" />
        </button>
        <div className="study-progress">
          <motion.i style={{ background: accent }} animate={{ width: `${Math.max(3, (done / Math.max(1, state.total + state.missed.size)) * 100)}%` }} transition={soft} />
        </div>
        <span className="chip" style={{ color: '#f39a4c' }}>
          <Icon name="bolt" size={13} /> прогон
        </span>
      </div>
      <div className="stage">
        <AnimatePresence mode="wait" custom={exitKind} initial={false}>
          <CardFace key={`${current.note}-${current.tries}-${revealed ? 'b' : 'f'}`} exitKind={exitKind} accent={accent}
            onSwipe={revealed ? (r) => answer(r > 1) : null}
            swipe={{
              left: { icon: 'close', label: 'Не знаю', sub: 'вернётся позже', tone: 'again' },
              right: { icon: 'check', label: 'Знаю', sub: 'идём дальше', tone: 'good' },
            }}
          >
            <div className="kicker">
              <span>{section?.emoji}</span>
              <span>{deck?.name}</span>
              <span className="spacer" />
              <span className="chip">знаю {known}</span>
            </div>
            {!revealed ? (
              <div className={`q-text ${vocab ? 'word' : ''}`}>
                <Content text={question} format={note.format} className={vocab ? '' : 'content'} />
              </div>
            ) : (
              <Back vocab={vocab} dir={current.dir} note={note} question={question} answer={ans} english={englishSide(note.front, note.back)} input="" verdict={null} compare={false} />
            )}
          </CardFace>
        </AnimatePresence>
      </div>
      <div className="study-actions">
        {!revealed ? (
          <button
            className="btn block"
            style={{ background: accent, color: '#fff' }}
            onClick={() => {
              setExitKind({ type: 'flip' })
              setRevealed(true)
            }}
          >
            Показать ответ
          </button>
        ) : (
          <div className="rate" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <motion.button className="r1" whileTap={{ scale: 0.92 }} onClick={() => answer(false)}>
              Не знаю
              <small>вернётся позже</small>
            </motion.button>
            <motion.button className="r3" whileTap={{ scale: 0.92 }} onClick={() => answer(true)}>
              Знаю
              <small>дальше</small>
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}
