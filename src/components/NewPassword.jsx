import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { sb, RECOVERY } from '../lib/supabase'
import { Sheet, toast } from './ui'

// Открывается после перехода по ссылке «сбросить пароль» из письма
export default function NewPassword() {
  const [open, setOpen] = useState(RECOVERY)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { data } = sb.auth.onAuthStateChange((e) => e === 'PASSWORD_RECOVERY' && setOpen(true))
    return () => data.subscription.unsubscribe()
  }, [])

  async function save() {
    if (pw.length < 6) return setError('Минимум 6 символов')
    setBusy(true)
    const { error } = await sb.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setError(error.message)
    setOpen(false)
    toast('Пароль обновлён')
  }

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Новый пароль">
      <div className="row" style={{ marginBottom: 14 }}>
        <KeyRound size={22} style={{ color: 'var(--accent)' }} />
        <span className="muted small">Придумай новый пароль для входа на всех устройствах</span>
      </div>
      <input className="input" type="password" autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="••••••••" />
      {error && (
        <div className="error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={save}>
        Сохранить пароль
      </button>
    </Sheet>
  )
}
