import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, Lock, ArrowRight, Flame, Check, Sparkles } from 'lucide-react'
import Logo from '../components/Logo'
import { sb } from '../lib/supabase'
import { Segmented } from '../components/ui'
import { liquid, liquidSoft } from '../components/fluid'

const ERRORS = {
  'Invalid login credentials': 'Неверная почта или пароль',
  'Email not confirmed': 'Почта не подтверждена — открой письмо от Supabase',
  'User already registered': 'Такой пользователь уже есть — войди',
}

const TAGLINES = ['Привычки — каждый день', 'Карточки к собеседованию', 'Английский в дороге', 'Серии, которые не хочется рвать']
const COLORS = ['#f4c34a', '#f2706b', '#6fd98a', '#5ab1f5', '#a284f5', '#ec7bb8', '#5ccbe8']

// Формы «капли» для жидкого логотипа — framer плавно перетекает между ними
const BLOBS = [
  'M60,8 C86,8 112,30 112,60 C112,90 88,112 60,112 C30,112 8,92 8,60 C8,28 34,8 60,8 Z',
  'M62,6 C92,10 114,34 110,64 C106,94 84,114 56,112 C26,110 6,86 10,56 C14,26 34,4 62,6 Z',
  'M58,10 C88,4 116,28 112,58 C108,92 86,110 60,114 C28,118 4,90 8,60 C12,32 30,14 58,10 Z',
]

export default function Auth() {
  const [mode, setMode] = useState('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    const back = location.origin + location.pathname
    const fn =
      mode === 'reset'
        ? sb.auth.resetPasswordForEmail(email, { redirectTo: back })
        : mode === 'in'
          ? sb.auth.signInWithPassword({ email, password })
          : sb.auth.signUp({ email, password, options: { emailRedirectTo: back } })
    const { data, error } = await fn
    setBusy(false)
    if (error) {
      const m = error.message
      setError(ERRORS[m] || (/at least 6/.test(m) ? 'Пароль — минимум 6 символов' : /rate limit/i.test(m) ? 'Слишком много писем — попробуй через час' : m))
    } else if (mode === 'reset') {
      setInfo('Письмо отправлено. Открой ссылку из него — приложение попросит новый пароль.')
      setMode('in')
    } else if (mode === 'up' && !data.session) {
      setInfo('Готово! Подтверди почту по ссылке из письма и войди.')
      setMode('in')
    }
  }

  return (
    <div className="auth-wow">
      <LivingGrid />
      <div className="auth-inner">
        <Hero />

        <motion.form
          className="auth-card"
          onSubmit={submit}
          initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
          transition={{ ...liquidSoft, delay: 0.35 }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {mode !== 'reset' ? (
              <motion.div key="seg" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={liquid} style={{ marginBottom: 16 }}>
                <Segmented
                  full
                  value={mode}
                  onChange={(m) => (setMode(m), setError(''))}
                  options={[
                    { value: 'in', label: 'Вход' },
                    { value: 'up', label: 'Регистрация' },
                  ]}
                />
              </motion.div>
            ) : (
              <motion.p key="hint" className="muted small" style={{ margin: '0 4px 14px' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Пришлём на почту ссылку для нового пароля.
              </motion.p>
            )}
          </AnimatePresence>

          <label className="glass-field">
            <Mail size={18} />
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Почта" />
          </label>
          <AnimatePresence initial={false}>
            {mode !== 'reset' && (
              <motion.label className="glass-field" initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 54, marginTop: 10 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={liquid}>
                <Lock size={18} />
                <input
                  type="password"
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'up' ? 'Пароль (от 6 символов)' : 'Пароль'}
                />
              </motion.label>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(error || info) && (
              <motion.div className="error" style={{ margin: '12px 4px 0', color: info ? 'var(--good)' : undefined }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {error || info}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button className="btn primary block shine" disabled={busy} style={{ marginTop: 16, height: 56 }} whileTap={{ scale: 0.97 }}>
            {busy ? (
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} style={{ display: 'inline-flex' }}>
                <Sparkles size={20} />
              </motion.span>
            ) : (
              <>
                {mode === 'reset' ? 'Отправить ссылку' : mode === 'in' ? 'Войти' : 'Создать аккаунт'} <ArrowRight size={18} />
              </>
            )}
          </motion.button>

          <button
            type="button"
            className="small"
            style={{ display: 'block', margin: '16px auto 2px', color: 'var(--accent)', fontWeight: 650 }}
            onClick={() => (setMode(mode === 'reset' ? 'in' : 'reset'), setError(''), setInfo(''))}
          >
            {mode === 'reset' ? '← Назад ко входу' : 'Забыли пароль?'}
          </button>
        </motion.form>
      </div>
    </div>
  )
}

function Hero() {
  const [i, setI] = useState(0)
  const [blob, setBlob] = useState(0)
  useEffect(() => {
    const a = setInterval(() => setI((x) => (x + 1) % TAGLINES.length), 2600)
    const b = setInterval(() => setBlob((x) => (x + 1) % BLOBS.length), 1800)
    return () => (clearInterval(a), clearInterval(b))
  }, [])

  return (
    <div className="auth-hero">
      {/* Парящая сцена: жидкий логотип, карточка вопроса и бейджи привычек */}
      <div className="scene">
        <motion.div className="logo-blob" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 12, delay: 0.1 }}>
          <svg viewBox="0 0 120 120" width="96" height="96">
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#7c7eff" />
                <stop offset="0.55" stopColor="#a855f7" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <motion.path d={BLOBS[0]} animate={{ d: BLOBS[blob] }} transition={{ duration: 1.8, ease: 'easeInOut' }} fill="url(#lg)" />
          </svg>
          <span style={{ position: 'absolute', display: 'grid' }}>
            <Logo size={52} dim={0.2} />
          </span>
        </motion.div>

        <motion.div
          className="float-card"
          initial={{ opacity: 0, rotateY: -50, x: 40 }}
          animate={{ opacity: 1, rotateY: [-14, 14, -14], x: 0, y: [0, -8, 0] }}
          transition={{ opacity: { delay: 0.4 }, x: liquid, rotateY: { duration: 8, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <div className="mono-label" style={{ fontSize: 9 }}>
            Swift · вопрос
          </div>
          <div style={{ fontWeight: 750, fontSize: 14, lineHeight: 1.3, marginTop: 4 }}>struct или class?</div>
          <div className="mini-rate">
            <i style={{ background: 'var(--again)' }} />
            <i style={{ background: 'var(--hard)' }} />
            <i style={{ background: 'var(--good)' }} />
            <i style={{ background: 'var(--easy)' }} />
          </div>
        </motion.div>

        <Badge style={{ left: '2%', top: '64%' }} delay={0.55} dur={5}>
          <Flame size={15} color="#ff7a1a" fill="#ffb43a" /> 21 день
        </Badge>
        <Badge style={{ right: '0%', top: '10%' }} delay={0.7} dur={6}>
          <span className="tick" style={{ background: '#6fd98a' }}>
            <Check size={11} strokeWidth={3.5} color="#fff" />
          </span>
          LeetCode
        </Badge>
        <Badge style={{ right: '4%', top: '74%' }} delay={0.85} dur={4.6}>
          <span className="tick" style={{ background: '#5ab1f5' }}>
            <Check size={11} strokeWidth={3.5} color="#fff" />
          </span>
          come up with
        </Badge>
      </div>

      <motion.h1 className="auth-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...liquid, delay: 0.2 }}>
        My Habit <span>Quizly</span>
      </motion.h1>
      <div className="tagline">
        <AnimatePresence mode="wait">
          <motion.span key={i} initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }} transition={{ duration: 0.45 }}>
            {TAGLINES[i]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}

function Badge({ children, style, delay, dur }) {
  return (
    <motion.div
      className="float-badge"
      style={style}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
      transition={{ opacity: { delay }, scale: { ...liquid, delay }, y: { duration: dur, repeat: Infinity, ease: 'easeInOut', delay } }}
    >
      {children}
    </motion.div>
  )
}

// Фон: «живая» тепловая карта — точки загораются цветной волной по диагонали
function LivingGrid() {
  const cells = useMemo(() => {
    const out = []
    let seed = 11
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let y = 0; y < 30; y++)
      for (let x = 0; x < 16; x++) {
        const lit = rnd() < 0.36
        out.push({ k: `${x}-${y}`, lit, c: COLORS[(x + Math.floor(y / 3)) % COLORS.length], d: (x + y) * 0.07 + rnd() * 0.4 })
      }
    return out
  }, [])
  return (
    <div className="living-grid" aria-hidden="true">
      {cells.map((c) => (
        <i key={c.k} className={c.lit ? 'lit' : ''} style={c.lit ? { '--c': c.c, animationDelay: `${c.d}s` } : undefined} />
      ))}
    </div>
  )
}
