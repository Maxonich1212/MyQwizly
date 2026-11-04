import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, animate, useMotionValue, useTransform, useDragControls } from 'framer-motion'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import { back } from '../lib/ui'

export const spring = { type: 'spring', stiffness: 300, damping: 26 }
export const soft = { type: 'spring', stiffness: 170, damping: 22 }

export function TopBar({ title, onBack, right, fallback = '/' }) {
  return (
    <div className="topbar">
      <button className="icon-btn" onClick={onBack || (() => back(fallback))} aria-label="Назад">
        <Icon name="back" />
      </button>
      <div className="grow">{title && <h2>{title}</h2>}</div>
      {right || <div style={{ width: 40 }} />}
    </div>
  )
}

// Шторка: листается как обычная страница, закрывается свайпом вниз только за полоску сверху.
// Рендерится в body (портал) — так её не обрезают трансформации экрана, а фон под ней не прокручивается
export function Sheet({ open, onClose, title, children }) {
  const controls = useDragControls()
  useEffect(() => {
    if (!open) return
    const on = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', on)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  const wide = typeof window !== 'undefined' && window.innerWidth >= 720
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="sheet"
            initial={wide ? { opacity: 0, scale: 0.94, y: '-46%' } : { y: '100%' }}
            animate={wide ? { opacity: 1, scale: 1, y: '-50%' } : { y: 0 }}
            exit={wide ? { opacity: 0, scale: 0.96, y: '-48%' } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag={wide ? false : 'y'}
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, i) => (i.offset.y > 100 || i.velocity.y > 500) && onClose()}
          >
            <div className="sheet-handle" onPointerDown={(e) => controls.start(e)}>
              <div className="grabber" />
            </div>
            {title && <h3>{title}</h3>}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Segmented({ options, value, onChange, full }) {
  const id = useId()
  return (
    <div className={`segmented ${full ? 'full' : ''}`}>
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="thumb" transition={spring} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ on, onChange }) {
  return (
    <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <i />
    </button>
  )
}

export function Stepper({ value, onChange, min = 1, max = 500, step = 1 }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <b>{value}</b>
      <button onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  )
}

// Плавный счётчик чисел
const round = (v) => Math.round(v)
export function Counter({ value, format = round }) {
  const ref = useRef(null)
  const prev = useRef(0)
  const fmt = useRef(format)
  fmt.current = format
  useEffect(() => {
    const c = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => ref.current && (ref.current.textContent = fmt.current(v)),
    })
    prev.current = value
    return () => c.stop()
  }, [value])
  return <span ref={ref} className="tnum">{format(0)}</span>
}

// Кольцо прогресса с градиентом
export function Ring({ value, size = 120, stroke = 12, from = '#6366f1', to = '#a855f7', children }) {
  const id = useId().replace(/:/g, '')
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}

// Огонёк стрика: живой, если день засчитан; серый, если ещё нет
export function Flame({ size = 22, active = true, animated = true }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={active && animated ? 'flame-live' : undefined} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`f${id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={active ? '#ff4d1a' : '#9aa0ad'} />
          <stop offset="1" stopColor={active ? '#ffb43a' : '#c3c7d0'} />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5c.6 3.2 3 4.7 4.6 6.8 1.4 1.8 2.4 3.7 2.4 6A7 7 0 0 1 5 15.3c0-2.5 1.2-4.4 2.6-5.8.3 1.6 1.2 2.7 2.4 3.2-.5-3.4.4-7.2 2-10.2z"
        fill={`url(#f${id})`}
      />
      <path d="M12 21.5a3.6 3.6 0 0 1-3.6-3.6c0-2 1.6-3.2 2.6-4.6.4 1.2 1.3 1.8 2.2 2.1.4-1 .4-1.9.3-2.8 1.3 1.1 2.1 2.8 2.1 4.6a3.6 3.6 0 0 1-3.6 4.3z" fill={active ? '#ffe08a' : '#e1e4ea'} opacity="0.9" />
    </svg>
  )
}

let toastSet = null
export function toast(text) {
  toastSet?.({ text, key: Date.now() })
}
export function ToastHost() {
  const [t, setT] = useState(null)
  toastSet = setT
  useEffect(() => {
    if (!t) return
    const id = setTimeout(() => setT(null), 2600)
    return () => clearTimeout(id)
  }, [t])
  return (
    <AnimatePresence>
      {t && (
        <motion.div
          key={t.key}
          className="toast"
          initial={{ opacity: 0, y: 20, x: '-50%', scale: 0.95 }}
          animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
          exit={{ opacity: 0, y: 10, x: '-50%' }}
          transition={spring}
        >
          {t.text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Строка списка с лёгким «нажатием» (с задержкой — чтобы не дёргалась при прокрутке)
export function Pressable({ children, className = '', ...rest }) {
  return (
    <button className={`${className} press`} {...rest}>
      {children}
    </button>
  )
}

// Свайп карточки в сторону (используется в учёбе для «Снова»/«Хорошо»)
export function useSwipe(onLeft, onRight, enabled) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-8, 8])
  const leftGlow = useTransform(x, [-140, -20], [1, 0])
  const rightGlow = useTransform(x, [20, 140], [0, 1])
  const bind = enabled
    ? {
        drag: 'x',
        dragConstraints: { left: 0, right: 0 },
        dragElastic: 0.9,
        onDragEnd: (_, i) => {
          if (i.offset.x < -110 || i.velocity.x < -700) onLeft()
          else if (i.offset.x > 110 || i.velocity.x > 700) onRight()
        },
        style: { x, rotate },
      }
    : { style: {} }
  return { bind, leftGlow, rightGlow }
}
