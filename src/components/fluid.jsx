import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { addDays, dayKey, parseKey, weekStart } from '../lib/day'

// «Водяная» пружина: мягкая, с небольшим перекатом — элементы перетекают, а не щёлкают
export const liquid = { type: 'spring', stiffness: 170, damping: 21, mass: 1 }
export const liquidSoft = { type: 'spring', stiffness: 120, damping: 20, mass: 1.1 }

// Волна с периодом 50 на длину 200: сдвиг на 100 бесшовный, кнопка видит участок 0..100
// Волна — html-слой с CSS-анимацией сдвига: её считает видеокарта, а не JS на каждом кадре
const WAVE = 'M0 12 Q 12.5 0 25 12 T 50 12 T 75 12 T 100 12 T 125 12 T 150 12 T 175 12 T 200 12 V 140 H 0 Z'

// Кнопка-отметка: цвет наливается снизу волной до уровня прогресса, затем проявляется галочка
export function LiquidCheck({ progress = 0, color, onTap, size = 52, round = false, label, onLongPress }) {
  const p = Math.max(0, Math.min(1, progress))
  const done = p >= 1
  const lp = useLongPress(onLongPress)
  // Волна «плещется» только пока уровень меняется или заполнено частично
  const [splash, setSplash] = useState(false)
  const prev = useRef(p)
  useEffect(() => {
    if (prev.current === p) return
    prev.current = p
    setSplash(true)
    const t = setTimeout(() => setSplash(false), 1600)
    return () => clearTimeout(t)
  }, [p])
  const moving = splash || (p > 0 && p < 1)
  return (
    <motion.button
      className={`liquid ${round ? 'round-l' : ''}`}
      style={{ '--c': color, width: size, height: size, borderColor: done ? 'transparent' : undefined }}
      whileTap={{ scale: 0.86 }}
      transition={liquid}
      onClick={(e) => {
        if (lp.fired()) return
        e.stopPropagation()
        onTap?.()
      }}
      {...lp.handlers}
      aria-pressed={done}
    >
      <motion.div className="water" initial={false} animate={{ y: done ? '-14%' : p <= 0 ? '102%' : `${(1 - p) * 100 - 8}%` }} transition={liquidSoft}>
        <div className={`wave ${moving ? 'moving' : ''}`}>
          <svg viewBox="0 0 200 140" preserveAspectRatio="none">
            <path d={WAVE} fill={color} />
          </svg>
        </div>
      </motion.div>
      {label != null && !done ? (
        <span className="count" style={{ color: p > 0.45 ? '#fff' : undefined }}>
          {label}
        </span>
      ) : (
        <motion.span className="mark" initial={false} animate={{ scale: done ? [0.6, 1.15, 1] : 0.9 }} transition={{ duration: 0.45 }} style={{ color: done ? '#fff' : 'var(--text-3)' }}>
          <Check size={round ? 16 : 20} strokeWidth={done ? 3 : 2.2} />
        </motion.span>
      )}
    </motion.button>
  )
}

// Долгое нажатие (телефон) + правый клик (компьютер)
export function useLongPress(cb, ms = 420) {
  const timer = useRef(null)
  const firedRef = useRef(false)
  const origin = useRef({ x: 0, y: 0 })
  if (!cb) return { handlers: {}, fired: () => false }
  const start = (e) => {
    firedRef.current = false
    const { clientX: x, clientY: y } = e
    origin.current = { x, y }
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
      onPointerCancel: cancel,
      onPointerMove: (e) => (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 8 ? cancel() : null),
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

// Тепловая карта точками: колонки — недели, строки — дни Пн…Вс. level(day) → 0..1 | null (день не по расписанию).
// Рисуется на одном <canvas>: сотни отдельных элементов-точек заметно тормозили вход на экран
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function roundRect(ctx, x, y, s, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + s, y, x + s, y + s, r)
  ctx.arcTo(x + s, y + s, x, y + s, r)
  ctx.arcTo(x, y + s, x, y, r)
  ctx.arcTo(x, y, x + s, y, r)
  ctx.closePath()
}

export function DotGrid({ level, color, dot = 7.5, gap = 3, minWeeks = 8, maxWeeks = 53, from }) {
  const wrap = useRef(null)
  const canvas = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const weeks = width ? Math.max(minWeeks, Math.min(maxWeeks, Math.floor((width + gap) / (dot + gap)))) : 0
  // Клетки растягиваются на всю ширину, как в CSS-сетке
  const cell = weeks ? (width - gap * (weeks - 1)) / weeks : dot
  const height = Math.round(cell * 7 + gap * 6)

  // Уровни считаем строкой-ключом: перерисовываем холст, только если что-то реально поменялось
  const today = dayKey()
  const levels = []
  if (weeks) {
    const start = addDays(weekStart(today), -(weeks - 1) * 7)
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i)
      if (d > today) levels.push('f')
      else if (from && d < from) levels.push('b')
      else {
        const l = level(d)
        levels.push(l == null ? 'n' : l > 0 ? Math.round(l * 100) / 100 : 0)
      }
    }
  }
  const key = levels.join(',')
  const dark = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'

  useLayoutEffect(() => {
    const c = canvas.current
    if (!c || !weeks) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    c.width = Math.round(width * dpr)
    c.height = Math.round(height * dpr)
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const [r, g, b] = hexToRgb(color)
    const base = dark ? [150, 152, 170] : [110, 112, 130]
    const radius = cell * 0.28
    const todayIndex = (weeks - 1) * 7 + ((parseKey(today).getDay() + 6) % 7)
    levels.forEach((l, i) => {
      const col = Math.floor(i / 7)
      const row = i % 7
      const x = col * (cell + gap)
      const y = row * (cell + gap)
      const isToday = i === todayIndex
      ctx.shadowBlur = 0
      if (l === 'f' || l === 'n') {
        // Будущее и дни не по расписанию — маленькая точка
        ctx.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${l === 'f' ? 0.06 : 0.12})`
        ctx.beginPath()
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.14, 0, Math.PI * 2)
        ctx.fill()
        return
      }
      roundRect(ctx, x, y, cell, radius)
      if (typeof l === 'number' && l > 0) {
        if (isToday) {
          ctx.shadowColor = `rgba(${r},${g},${b},0.9)`
          ctx.shadowBlur = 8
        }
        ctx.fillStyle = `rgba(${r},${g},${b},${0.4 + 0.6 * l})`
        ctx.fill()
      } else {
        // Пустая клетка с еле заметным оттенком цвета привычки
        ctx.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${dark ? 0.09 : 0.1})`
        ctx.fill()
        ctx.fillStyle = `rgba(${r},${g},${b},${l === 'b' ? 0.04 : 0.08})`
        ctx.fill()
        if (isToday) {
          ctx.strokeStyle = `rgba(${r},${g},${b},0.75)`
          ctx.lineWidth = 1.4
          roundRect(ctx, x + 0.7, y + 0.7, cell - 1.4, radius)
          ctx.stroke()
        }
      }
    })
  }, [key, width, height, color, dark, cell, gap, weeks, today]) // eslint-disable-line

  return (
    <div ref={wrap} className="dots-wrap" style={{ height: weeks ? height : Math.round(dot * 7 + gap * 6) }}>
      {weeks > 0 && <canvas ref={canvas} style={{ width, height, display: 'block' }} />}
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
    out.push(<i key={k} className={k === today ? (l > 0 ? 'today' : 'today-empty') : undefined} style={l > 0 ? { background: color, opacity: 0.4 + 0.6 * l, '--c': color } : { opacity: k > today ? 0.45 : 1, '--c': color }} />)
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
