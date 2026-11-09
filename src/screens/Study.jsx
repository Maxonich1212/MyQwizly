import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { getState, patch, upsert, uid, useStore } from '../lib/store'
import { buildQueue, randomQueue } from '../lib/queue'
import { gradeNote, Rating } from '../lib/srs'
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
import { playSound } from '../lib/sfx'

function parseScope(s) {
  if (s.startsWith('s:')) return { sectionId: s.slice(2) }
  if (s.startsWith('d:')) return { deckId: s.slice(2) }
  return { all: true }
}

// study/<scope> — по расписанию; go:<n>:<scope> — n случайных («Погнали»);
// go:<n>:ids — n случайных из списка (кучка «Не знаю» / «Знаю»), сам список лежит в sessionStorage
export default function Study({ scope }) {
  if (scope.startsWith('go:')) {
    const [, n, ...rest] = scope.split(':')
    const target = rest.join(':')
    return <Learn scope={target === 'ids' ? 'all' : target} goCount={Number(n) || 10} goIds={target === 'ids'} />
  }
  return <Learn scope={scope} />
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

// Как в Quizlet: ответ только «знаю» или «не знаю». Круг — каждая карточка ровно один раз.
// В конце круга — две кучки; «не знаю» можно сразу пройти ещё раз следующим кругом (по желанию).
function Learn({ scope: scopeStr, goCount, goIds }) {
  const scope = useMemo(() => parseScope(scopeStr), [scopeStr])
  const settings = useStore((s) => s.settings)
  const notes = useStore((s) => s.notes)
  const decks = useStore((s) => s.decks)
  const sections = useStore((s) => s.sections)

  // Очередь снимаем один раз при входе. Первая карточка берётся в том же инициализаторе (StrictMode вызывает его дважды)
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
    const s = { queue: [...queue, ...later] }
    s.total = s.queue.length
    s.first = s.queue.shift() || null
    return s
  })
  const [current, setCurrent] = useState(session.first)
  const [revealed, setRevealed] = useState(false)
  const [input, setInput] = useState('')
  const [unknown, setUnknown] = useState(false) // нажал «Не знаю» до проверки — ответ раскрыт, решение уже принято
  const [swipeHint, setSwipeHint] = useState(() => !localStorage.getItem('mq-swiped'))
  const [exitKind, setExitKind] = useState({ type: 'next', rating: 3 })
  const [round, setRound] = useState({ n: 1, total: session.total, done: 0 })
  const [stats, setStats] = useState({ done: 0, know: 0, ms: 0 })
  const [celebrate, setCelebrate] = useState(null)
  const [editing, setEditing] = useState(false)
  const outcomes = useRef([]) // ответы текущего круга: { note, dir, know }
  const shownAt = useRef(Date.now())
  const startedAt = useRef(Date.now())
  // Звук уже прозвучал для этой карточки (слово проверено при вводе) — на ответе второй раз не играем
  const sounded = useRef(false)

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

  // Подсказка, какая кнопка подходит: true — «знаю», false — «не знаю», null — решай сам
  const suggested = useMemo(() => {
    if (unknown) return false
    if (!verdict) return null
    if (verdict.kind === 'vocab') return verdict.verdict !== 'wrong'
    return verdict.ratio >= 0.6
  }, [verdict, unknown])

  // Автоозвучка английского слова, когда оно на экране
  useEffect(() => {
    if (!vocab || !settings.autoSpeak || !english || !note) return
    const showsEnglish = (!revealed && dir === 'fwd') || (revealed && dir === 'rev')
    if (showsEnglish) speak(english)
  }, [vocab, settings.autoSpeak, english, note?.id, dir, revealed]) // eslint-disable-line

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

  // Ответ на карточку. Под капотом — расписание повторений: «знаю» = Хорошо, «не знаю» = Снова
  const respond = useCallback(
    (know) => {
      if (!current || !revealed) return
      const st = getState()
      const n = st.notes[current.note]
      const d = st.decks[n.deck_id]
      const now = new Date()
      const before = aggregate(st.reviews)[dayKey()]?.n || 0
      const rating = know ? Rating.Good : Rating.Again
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
      outcomes.current.push({ note: n.id, dir: current.dir, know })
      setRound((r) => ({ ...r, done: r.done + 1 }))
      setStats((x) => ({ done: x.done + 1, know: x.know + (know ? 1 : 0), ms: x.ms + Math.min(ms, 120000) }))
      haptic(know ? 10 : [10, 40, 10])
      if (!sounded.current) playSound(know ? 'ok' : 'bad')
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
      setCurrent(session.queue.shift() || null)
      shownAt.current = Date.now()
    },
    [current, revealed, session],
  )

  // Следующий круг — только те, что не знал в этом кругу
  const nextRound = useCallback(() => {
    const missed = shuffle(outcomes.current.filter((o) => !o.know).map((o) => ({ note: o.note, dir: o.dir })))
    if (!missed.length) return
    const total = missed.length // до shift(): обновление состояния выполняется позже и увидело бы уже сокращённый список
    session.queue = missed
    outcomes.current = []
    setRound((r) => ({ n: r.n + 1, total, done: 0 }))
    setExitKind({ type: 'next', rating: 3 })
    setCurrent(session.queue.shift())
    shownAt.current = Date.now()
  }, [session])

  // Карточку убрали из учёбы (или удалили) прямо во время сессии — молча переходим к следующей
  useEffect(() => {
    if (!current || !note || (!note.suspended && !note.deleted)) return
    setRound((r) => ({ ...r, total: Math.max(r.done, r.total - 1) }))
    setExitKind({ type: 'next', rating: 3 })
    setRevealed(false)
    setInput('')
    setUnknown(false)
    setCurrent(session.queue.shift() || null)
    shownAt.current = Date.now()
  }, [note?.suspended, note?.deleted]) // eslint-disable-line

  // Клавиатура: пробел/Enter — показать ответ; ← или 1 — не знаю, → или 2 — знаю
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
      if (e.key === 'ArrowLeft' || e.key === '1') respond(false)
      else if ((e.key === 'ArrowRight' || e.key === '2') && !unknown) respond(true)
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (unknown) respond(false)
        else if (suggested !== null) respond(suggested)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [revealed, reveal, respond, suggested, unknown, editing])

  // Карточку удалили (здесь или на другом устройстве) — просто идём дальше
  useEffect(() => {
    if (current && (!note || note.deleted)) setCurrent(session.queue.shift() || null)
  }, [current, note, session])

  const progress = round.total ? round.done / round.total : 0

  if (!current)
    return (
      <Finished
        stats={stats}
        startedAt={startedAt.current}
        empty={session.total === 0}
        outcomes={outcomes.current}
        notes={notes}
        round={round}
        onRepeat={nextRound}
      />
    )
  if (!note || note.deleted) return null

  const accent = section ? gradient(section.color, 90) : undefined
  const swipe = unknown
    ? { left: { icon: 'close', label: 'Не знаю', sub: 'в кучку «Не знаю»' } }
    : { left: { icon: 'close', label: 'Не знаю', sub: 'в кучку «Не знаю»' }, right: { icon: 'check', label: 'Знаю', sub: 'в кучку «Знаю»' } }

  return (
    <div className="study app">
      <div className="row" style={{ gap: 12 }}>
        <button className="icon-btn ghost" onClick={() => back()} aria-label="Закончить">
          <Icon name="close" />
        </button>
        <div className="study-progress">
          <motion.i style={{ background: accent }} initial={{ width: '3%' }} animate={{ width: `${Math.max(3, progress * 100)}%` }} transition={soft} />
        </div>
        {round.n > 1 && <span className="chip accent">круг {round.n}</span>}
        <span className="small faint tnum" style={{ minWidth: 44, textAlign: 'right', fontWeight: 600 }}>
          {round.done}/{round.total}
        </span>
      </div>

      <div className="stage">
        <AnimatePresence mode="wait" custom={exitKind} initial={false}>
          <CardFace
            key={`${current.note}-${current.dir}-${revealed ? 'b' : 'f'}`}
            exitKind={exitKind}
            accent={accent}
            swipe={swipe}
            onSwipe={
              revealed
                ? (know) => {
                    localStorage.setItem('mq-swiped', '1')
                    setSwipeHint(false)
                    respond(know)
                  }
                : null
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
              <Front vocab={vocab} dir={dir} note={note} question={question} english={english} input={input} setInput={setInput} onSubmit={reveal} />
            ) : (
              <Back vocab={vocab} note={note} question={question} answer={answer} english={english} input={input} verdict={verdict} unknown={unknown} />
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
          ) : unknown ? (
            <motion.div key="next" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.18 }}>
              <button className="btn block yn no solid" onClick={() => respond(false)}>
                Запомнил, дальше →
              </button>
              <div className="small faint" style={{ textAlign: 'center', marginTop: 8 }}>
                Карточка попадёт в кучку «Не знаю» — её можно будет пройти ещё раз
              </div>
            </motion.div>
          ) : (
            <motion.div key="rate" initial="h" animate="s" exit={{ opacity: 0, y: 10, transition: { duration: 0.12 } }} variants={{ s: { transition: { staggerChildren: 0.05 } } }}>
              {swipeHint && (
                <div className="swipe-hint">
                  <div>
                    <span>← Не знаю</span>
                    <span>Знаю →</span>
                  </div>
                  <i>свайп только ставит ответ — ничего не удаляется</i>
                </div>
              )}
              <div className="yn-row">
                <motion.button
                  className={`yn no ${suggested === false ? 'suggest' : ''}`}
                  onClick={() => respond(false)}
                  variants={{ h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0, transition: spring } }}
                  whileTap={{ scale: 0.94 }}
                >
                  <Icon name="close" size={20} stroke={2.8} /> Не знаю
                </motion.button>
                <motion.button
                  className={`yn yes ${suggested === true ? 'suggest' : ''}`}
                  onClick={() => respond(true)}
                  variants={{ h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0, transition: spring } }}
                  whileTap={{ scale: 0.94 }}
                >
                  <Icon name="check" size={20} stroke={2.8} /> Знаю
                </motion.button>
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

const faceVariants = {
  enter: (k) => (k.type === 'flip' ? { rotateY: -90, opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: 0, y: 24, scale: 0.94, rotateY: 0 }),
  center: { rotateY: 0, opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 },
  exit: (k) =>
    k.type === 'flip'
      ? { rotateY: 90, transition: { duration: 0.16, ease: 'easeIn' } }
      : { opacity: 0, x: k.rating === 1 ? -140 : 140, rotate: k.rating === 1 ? -6 : 6, scale: 0.96, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } },
}

// Карточка: тянется только влево/вправо. Штамп с названием действия проявляется по мере движения
function CardFace({ children, exitKind, accent, onSwipe, swipe }) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-7, 7])
  const red = useTransform(x, [-140, -20], [0.9, 0])
  const green = useTransform(x, [20, 140], [0, 0.9])
  const leftOp = useTransform(x, [-120, -25], [1, 0])
  const rightOp = useTransform(x, [25, 120], [0, 1])
  const leftScale = useTransform(x, [-130, -60], [1.06, 0.85])
  const rightScale = useTransform(x, [60, 130], [0.85, 1.06])
  const ref = useRef(null)
  const canRight = !!swipe?.right

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
      drag={onSwipe ? 'x' : false}
      dragSnapToOrigin
      dragElastic={canRight ? 0.85 : { left: 0.85, right: 0.1 }}
      onDragEnd={(_, i) => {
        if (!onSwipe) return
        if (i.offset.x < -120 || i.velocity.x < -800) onSwipe(false)
        else if (canRight && (i.offset.x > 120 || i.velocity.x > 800)) onSwipe(true)
      }}
      style={{ x, rotate, position: 'relative', touchAction: onSwipe ? 'pan-y' : 'auto' }}
    >
      <div className="face" ref={ref}>
        {accent && <div className="accent-bar" style={{ background: accent }} />}
        {children}
      </div>
      {onSwipe && (
        <>
          <motion.div style={{ opacity: red, position: 'absolute', inset: 0, borderRadius: 28, boxShadow: 'inset 0 0 0 3px var(--again)', background: 'color-mix(in srgb, var(--again) 10%, transparent)', pointerEvents: 'none' }} />
          {canRight && <motion.div style={{ opacity: green, position: 'absolute', inset: 0, borderRadius: 28, boxShadow: 'inset 0 0 0 3px var(--good)', background: 'color-mix(in srgb, var(--good) 10%, transparent)', pointerEvents: 'none' }} />}
          {swipe && (
            <>
              <motion.div className="swipe-stamp again" style={{ opacity: leftOp, scale: leftScale }}>
                <Icon name={swipe.left.icon} size={20} stroke={3} />
                <div>
                  <b>{swipe.left.label}</b>
                  <small>{swipe.left.sub}</small>
                </div>
              </motion.div>
              {canRight && (
                <motion.div className="swipe-stamp good" style={{ opacity: rightOp, scale: rightScale }}>
                  <Icon name={swipe.right.icon} size={20} stroke={3} />
                  <div>
                    <b>{swipe.right.label}</b>
                    <small>{swipe.right.sub}</small>
                  </div>
                </motion.div>
              )}
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

function Back({ vocab, note, question, answer, english, input, verdict, unknown = false, compare = true }) {
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

// Итог круга: две кучки — «Знаю» и «Не знаю». «Не знаю» можно сразу пройти ещё раз (следующий круг)
function PileList({ items, notes, tone }) {
  return (
    <div className={`card list pile-list ${tone}`} style={{ boxShadow: 'none', textAlign: 'left' }}>
      {items.slice(0, 40).map((o) => {
        const n = notes[o.note]
        if (!n) return null
        const front = o.dir === 'rev' ? n.back : n.front
        const back = o.dir === 'rev' ? n.front : n.back
        return (
          <div key={`${o.note}${o.dir}`} className="list-item">
            <i className="dot" style={{ background: tone === 'no' ? 'var(--again)' : 'var(--good)' }} />
            <div className="main">
              <div className="t">{stripHtml(front).slice(0, 70)}</div>
              <div className="s">{stripHtml(back).slice(0, 90)}</div>
            </div>
          </div>
        )
      })}
      {items.length > 40 && <div className="list-item faint small">и ещё {items.length - 40}</div>}
    </div>
  )
}

function Finished({ stats, startedAt, empty, outcomes, notes, round, onRepeat }) {
  const reviews = useStore((s) => s.reviews)
  const settings = useStore((s) => s.settings)
  const days = useMemo(() => aggregate(reviews), [reviews])
  const streak = useMemo(() => globalStreak(days, settings), [days, settings])
  const today = days[dayKey()]?.n || 0
  const [showKnown, setShowKnown] = useState(false)
  const known = outcomes.filter((o) => o.know)
  const missed = outcomes.filter((o) => !o.know)
  const pct = outcomes.length ? known.length / outcomes.length : 0
  const minutes = fmtMinutes(Math.max(stats.ms, stats.done ? Date.now() - startedAt : 0))

  return (
    <div className="study app">
      <div className="finished-scroll">
        <motion.div style={{ textAlign: 'center' }} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={soft}>
          {empty ? (
            <div style={{ paddingTop: 80 }}>
              <div style={{ fontSize: 64, marginBottom: 10 }}>🌿</div>
              <h1 className="title">Пока нечего повторять</h1>
              <p className="subtitle">Все карточки на сегодня пройдены. Выбери «Погнали» — и пройди любое количество карточек сразу.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 14px' }}>
                <Ring value={pct} size={118} stroke={11} from="#10b981" to="#0ea5e9">
                  <div>
                    <b>
                      <Counter value={known.length} />
                      <span className="faint" style={{ fontSize: 16 }}>/{outcomes.length}</span>
                    </b>
                    <small>знаю</small>
                  </div>
                </Ring>
              </div>
              <h1 className="title" style={{ fontSize: 28 }}>
                {missed.length ? 'Круг пройден' : 'Всё знаешь! 🎉'}
              </h1>
              <p className="subtitle">
                {outcomes.length} {plural(outcomes.length, 'карточка', 'карточки', 'карточек')} · {minutes}
                {round.n > 1 ? ` · круг ${round.n}` : ''}
              </p>

              <div className="piles">
                <div className="pile yes">
                  <b className="tnum">{known.length}</b>
                  <span>Знаю</span>
                </div>
                <div className="pile no">
                  <b className="tnum">{missed.length}</b>
                  <span>Не знаю</span>
                </div>
              </div>

              {missed.length > 0 && (
                <>
                  <div className="mono-label pile-title">Не знаю — вот что повторить</div>
                  <PileList items={missed} notes={notes} tone="no" />
                </>
              )}
              {known.length > 0 && (
                <>
                  <button className="pile-toggle" onClick={() => setShowKnown(!showKnown)}>
                    {showKnown ? 'Скрыть' : 'Показать'} кучку «Знаю» · {known.length}
                  </button>
                  {showKnown && <PileList items={known} notes={notes} tone="yes" />}
                </>
              )}
              <div className="small faint" style={{ margin: '14px 8px 4px', lineHeight: 1.4 }}>
                <Flame size={13} animated={false} active={streak.current > 0} /> {streak.current} {plural(streak.current, 'день', 'дня', 'дней')} подряд · сегодня {today}.
                Кучки «Знаю» и «Не знаю» сохраняются — их видно в разделе и на вкладке «Карточки».
              </div>
            </>
          )}
        </motion.div>
      </div>
      <div className="finished-actions">
        {!empty && missed.length > 0 ? (
          <>
            <button className="btn primary block" onClick={onRepeat}>
              <Icon name="bolt" size={17} /> Повторить «Не знаю» · {missed.length}
            </button>
            <button className="btn secondary block" onClick={() => back()}>
              Закончить
            </button>
          </>
        ) : (
          <button className="btn primary block" onClick={() => back()}>
            Готово
          </button>
        )}
      </div>
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
