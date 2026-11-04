import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { addDays, dayKey, parseKey, weekStart } from '../lib/day'

// «Водяная» пружина: мягкая, с небольшим перекатом — элементы перетекают, а не щёлкают
export const liquid = { type: 'spring', stiffness: 170, damping: 21, mass: 1 }
export const liquidSoft = { type: 'spring', stiffness: 120, damping: 20, mass: 1.1 }

// Волна с периодом 50 на длину 200: сдвиг на 100 бесшовный, кнопка видит участок 0..100
const WAVE = 'M0 12 Q 12.5 0 25 12 T 50 12 T 75 12 T 100 12 T 125 12 T 150 12 T 175 12 T 200 12 V 140 H 0 Z'

// Кнопка-отметка: цвет наливается снизу волной до уровня прогресса, затем рисуется галочка
export function LiquidCheck({ progress = 0, color, onTap, size = 52, round = false, label, onLongPress }) {
  const p = Math.max(0, Math.min(1, progress))
  const done = p >= 1
  const lp = useLongPress(onLongPress)
  return (
    <motion.button
      className={`liquid ${round ? 'round-l' : ''}`}
      style={{ '--c': color, width: size, height: size, borderColor: done ? 'transparent' : undefined }}
      whileTap={{ scale: 0.86 }}
      animate={done ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={liquid}
      onClick={(e) => {
        if (lp.fired()) return
        e.stopPropagation()
        onTap?.()
      }}
      {...lp.handlers}
      aria-pressed={done}
    >
      <motion.svg
        className="water"
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
        overflow="visible"
        initial={false}
        animate={{ top: `${done ? -16 : p <= 0 ? 115 : (1 - p) * 100 - 6}%` }}
        transition={liquidSoft}
        style={{ position: 'absolute' }}
      >
        <motion.path
          d={WAVE}
          fill={color}
          animate={{ x: [0, -100] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
        />
      </motion.svg>
      {label != null && !done ? (
        <span className="count" style={{ color: p > 0.45 ? '#fff' : undefined }}>
          {label}
        </span>
      ) : (
        <motion.span className="mark" initial={false} animate={{ color: done ? '#fff' : 'var(--text-3)', scale: done ? 1 : 0.9 }} transition={liquid}>
          <Check size={round ? 18 : 22} strokeWidth={done ? 3 : 2.2} />
        </motion.span>
      )}
    </motion.button>
  )
}

// Долгое нажатие (телефон) + правый клик (компьютер)
export function useLongPress(cb, ms = 420) {
  const timer = useRef(null)
  const firedRef = useRef(false)
  if (!cb) return { handlers: {}, fired: () => false }
  const start = (e) => {
    firedRef.current = false
    const { clientX: x, clientY: y } = e
    timer.current = setTimeout(() => {
      firedRef.current = true
      navigator.vibrate?.(12)
      cb({ x, y })
    }, ms)
  }
  const cancel = () => clearTimeout(timer.current)
  return {
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerMove: (e) => (Math.abs(e.movementX) + Math.abs(e.movementY) > 6 ? cancel() : null),
      onContextMenu: (e) => {
        e.preventDefault()
        cancel()
        firedRef.current = true
        cb({ x: e.clientX, y: e.clientY })
      },
    },
    fired: () => {
      const f = firedRef.current
      firedRef.current = false
      return f
    },
  }
}

export function ContextMenu({ at, items, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    if (!at || !ref.current) return setPos(null)
    const r = ref.current.getBoundingClientRect()
    const x = Math.min(Math.max(12, at.x - r.width / 2), innerWidth - r.width - 12)
    const y = Math.min(Math.max(12, at.y + 8), innerHeight - r.height - 12)
    setPos({ x, y, ox: at.x - x, oy: at.y - y })
  }, [at])
  useEffect(() => {
    if (!at) return
    const on = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [at, onClose])
  return createPortal(
    <AnimatePresence>
      {at && (
        <>
          <motion.div
            className="backdrop"
            style={{ background: 'rgba(10,12,20,.25)', zIndex: 150 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            className="menu"
            style={{ left: pos?.x ?? -999, top: pos?.y ?? -999, transformOrigin: pos ? `${pos.ox}px ${pos.oy}px` : 'top center' }}
            initial={{ opacity: 0, scale: 0.6, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(6px)', transition: { duration: 0.16 } }}
            transition={liquid}
          >
            {items.map((it, i) =>
              it === '-' ? (
                <hr key={i} />
              ) : (
                <motion.button
                  key={it.label}
                  className={it.danger ? 'danger' : ''}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...liquid, delay: 0.02 * i }}
                  onClick={() => {
                    onClose()
                    it.onClick()
                  }}
                >
                  {it.icon}
                  {it.label}
                </motion.button>
              ),
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// Тепловая карта точками: колонки — недели, строки — дни Пн…Вс. level(day) → 0..1 | null (день не по расписанию)
export function DotGrid({ level, color, dot = 9, gap = 3.5, minWeeks = 8, maxWeeks = 53, from }) {
  const ref = useRef(null)
  const [weeks, setWeeks] = useState(minWeeks)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      setWeeks(Math.max(minWeeks, Math.min(maxWeeks, Math.floor((w + gap) / (dot + gap)))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [dot, gap, minWeeks, maxWeeks])

  const today = dayKey()
  const start = addDays(weekStart(today), -(weeks - 1) * 7)
  const cells = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i)
    const col = Math.floor(i / 7)
    if (d > today) {
      cells.push(<i key={d} className="na" style={{ opacity: 0.5 }} />)
      continue
    }
    // До создания привычки — просто тусклые клетки, сетка всегда выглядит цельной
    if (from && d < from) {
      cells.push(<i key={d} className="dot-in" style={{ animationDelay: `${(weeks - col) * 14}ms`, opacity: 0.6 }} />)
      continue
    }
    const l = level(d)
    const style = { animationDelay: `${(weeks - col) * 14}ms` }
    if (l == null) cells.push(<i key={d} className="na dot-in" style={style} />)
    else if (l > 0) {
      cells.push(
        <i
          key={d}
          className="dot-in"
          style={{
            ...style,
            background: color,
            opacity: 0.35 + 0.65 * l,
            boxShadow: `0 0 ${d === today ? 10 : 5}px color-mix(in srgb, ${color} ${d === today ? 80 : 35}%, transparent)`,
          }}
        />,
      )
    } else cells.push(<i key={d} className="dot-in" style={{ ...style, outline: d === today ? `1.5px solid color-mix(in srgb, ${color} 55%, transparent)` : undefined }} />)
  }
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <div className="dots" style={{ '--gap': `${gap}px`, gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {cells}
      </div>
    </div>
  )
}

// Мини-календарь месяца точками
export function MonthDots({ level, color, month = new Date() }) {
  const y = month.getFullYear()
  const m = month.getMonth()
  const first = new Date(y, m, 1, 12)
  const lead = (first.getDay() + 6) % 7
  const n = new Date(y, m + 1, 0).getDate()
  const today = dayKey()
  const out = []
  for (let i = 0; i < lead; i++) out.push(<i key={`p${i}`} className="lead" />)
  for (let d = 1; d <= n; d++) {
    const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const l = k > today ? 0 : level(k)
    out.push(<i key={k} className="dot-in" style={l > 0 ? { background: color, opacity: 0.3 + 0.7 * l, animationDelay: `${d * 10}ms` } : { animationDelay: `${d * 10}ms`, opacity: k > today ? 0.45 : 1 }} />)
  }
  return <div className="month-dots">{out}</div>
}

// Чипы с перетекающей подложкой
export function Pills({ items, value, onChange, id = 'pills' }) {
  return (
    <div className="chips">
      {items.map((it) => (
        <motion.button key={it.value} className={`pill ${value === it.value ? 'on' : ''}`} onClick={() => onChange(it.value)} whileTap={{ scale: 0.94 }} transition={liquid}>
          {value === it.value && <motion.i layoutId={id} className="pill-bg" transition={liquid} />}
          <span>
            {it.icon}
            {it.label}
          </span>
        </motion.button>
      ))}
    </div>
  )
}

export const weekdayIndex = (key) => (parseKey(key).getDay() + 6) % 7
