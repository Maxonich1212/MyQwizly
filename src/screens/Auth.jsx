import { useState } from 'react'
import { motion } from 'framer-motion'
import { sb } from '../lib/supabase'
import { Segmented, soft } from '../components/ui'
import Icon from '../components/Icon'

const ERRORS = {
  'Invalid login credentials': 'Неверная почта или пароль',
  'Email not confirmed': 'Почта не подтверждена — открой письмо от Supabase',
  'User already registered': 'Такой пользователь уже есть — войди',
}

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
    const fn =
      mode === 'in'
        ? sb.auth.signInWithPassword({ email, password })
        : sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
    const { data, error } = await fn
    setBusy(false)
    if (error) {
      const m = error.message
      setError(ERRORS[m] || (/at least 6/.test(m) ? 'Пароль — минимум 6 символов' : m))
    } else if (mode === 'up' && !data.session) {
      setInfo('Готово! Подтверди почту по ссылке из письма и войди.')
      setMode('in')
    }
  }

  return (
    <div className="auth">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={soft}>
        <motion.div className="logo" initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}>
          <Icon name="layers" size={36} />
        </motion.div>
        <h1 className="title">My Habit Quizly</h1>
        <p className="subtitle" style={{ marginBottom: 28 }}>
          Привычки и карточки для собеседований и английского. Всё синхронизируется между телефоном и компьютером.
        </p>
        <div style={{ marginBottom: 18 }}>
          <Segmented
            full
            value={mode}
            onChange={setMode}
            options={[
              { value: 'in', label: 'Вход' },
              { value: 'up', label: 'Регистрация' },
            ]}
          />
        </div>
        <form onSubmit={submit}>
          <label className="field">
            <span>Почта</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com" />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {error && <div className="error">{error}</div>}
          {info && <div className="error" style={{ color: 'var(--good)' }}>{info}</div>}
          <button className="btn primary block" disabled={busy} style={{ marginTop: 6 }}>
            {busy ? '…' : mode === 'in' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
