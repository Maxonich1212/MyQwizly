import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BellRing, Plus, X, Send } from 'lucide-react'
import { pushSupported, isStandalone, isIOS, loadPushPrefs, enablePush, disablePush, updatePushTimes, sendTestPush } from '../lib/push'
import { Switch, toast } from './ui'
import { liquid } from './fluid'

// Раздел настроек «Напоминания»: вечерняя проверка и напоминание перед сном
export default function Reminders() {
  const [prefs, setPrefs] = useState(loadPushPrefs)
  const [busy, setBusy] = useState(false)
  const supported = pushSupported()
  const needsHomeScreen = isIOS() && !isStandalone()

  async function toggle(on) {
    setBusy(true)
    try {
      if (on) {
        await enablePush(prefs.times)
        toast('Напоминания включены')
      } else {
        await disablePush()
      }
      setPrefs(loadPushPrefs())
    } catch (e) {
      toast(e.message === 'denied' ? 'Уведомления запрещены — разреши их в настройках iPhone' : 'Не получилось включить напоминания')
    } finally {
      setBusy(false)
    }
  }

  async function setTimes(times) {
    const next = { ...prefs, times }
    setPrefs(next)
    try {
      await updatePushTimes(times)
    } catch {
      toast('Не удалось сохранить время')
    }
  }

  async function test() {
    setBusy(true)
    try {
      await sendTestPush()
      toast('Отправлено — придёт через пару секунд')
    } catch {
      toast('Не получилось отправить тест')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="settings-row">
        {prefs.enabled ? <BellRing size={20} style={{ color: 'var(--accent)' }} /> : <Bell size={20} style={{ color: 'var(--text-2)' }} />}
        <div className="main">
          <div style={{ fontWeight: 600 }}>Напоминания</div>
          <div className="small faint">
            {needsHomeScreen
              ? 'Открой приложение с экрана «Домой» — iPhone разрешает уведомления только так'
              : !supported
                ? 'Этот браузер не поддерживает уведомления'
                : 'Придут, только если что-то не отмечено'}
          </div>
        </div>
        <Switch on={prefs.enabled} onChange={(v) => !busy && supported && !needsHomeScreen && toggle(v)} />
      </div>
      <AnimatePresence initial={false}>
        {prefs.enabled && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={liquid} style={{ overflow: 'hidden' }}>
            {prefs.times.map((t, i) => (
              <div key={i} className="settings-row">
                <div className="main">
                  <div style={{ fontWeight: 600 }}>{i === 0 ? 'Вечерняя проверка' : i === 1 ? 'Перед сном' : 'Ещё напоминание'}</div>
                </div>
                <input
                  type="time"
                  className="input time-input"
                  value={t}
                  onChange={(e) => e.target.value && setTimes(prefs.times.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {prefs.times.length > 1 && (
                  <button className="icon-btn ghost" style={{ width: 34, height: 34 }} onClick={() => setTimes(prefs.times.filter((_, j) => j !== i))} aria-label="Убрать">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <div className="settings-row" style={{ gap: 8 }}>
              {prefs.times.length < 4 && (
                <button className="btn secondary sm" onClick={() => setTimes([...prefs.times, '09:00'])}>
                  <Plus size={15} /> Время
                </button>
              )}
              <span className="spacer" />
              <button className="btn secondary sm" disabled={busy} onClick={test}>
                <Send size={15} /> Проверить
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
