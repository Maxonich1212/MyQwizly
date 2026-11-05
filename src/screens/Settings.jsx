import { motion } from 'framer-motion'
import { useStore, updateSettings, syncNow, signOut, releaseHeld } from '../lib/store'
import { plural } from '../lib/day'
import { confirmDialog } from '../components/Dialog'
import Reminders from '../components/Reminders'
import { go } from '../lib/ui'
import Icon from '../components/Icon'
import { Segmented, Stepper, Switch, soft, toast } from '../components/ui'

const fade = (i) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { ...soft, delay: 0.04 * i } })

export default function Settings() {
  const s = useStore((st) => st.settings)
  const user = useStore((st) => st.user)
  const sync = useStore((st) => st.sync)
  const pending = useStore((st) => st.pending)
  const held = useStore((st) => st.held)
  const waiting = pending - held

  async function logout(asked) {
    if (asked !== true && !(await confirmDialog({ title: 'Выйти из аккаунта?', text: 'Все данные останутся в облаке — войдёшь снова, и всё будет на месте.', ok: 'Выйти', danger: true }))) return
    if (user?.id === 'demo') return location.replace(location.pathname)
    try {
      await signOut()
    } catch (e) {
      if (e.message !== 'unsynced') throw e
      // Не даём потерять то, что ещё не в облаке
      if (e.held) {
        const send = await confirmDialog({
          title: 'Есть неотправленные карточки',
          text: `${e.held} ${plural(e.held, 'запись хранится', 'записи хранятся', 'записей хранятся')} только на этом устройстве. Отправить в облако перед выходом?`,
          ok: 'Отправить и выйти',
          cancel: 'Остаться',
        })
        if (!send) return
        releaseHeld()
        await syncNow().catch(() => {})
        return logout(true)
      }
      const force = await confirmDialog({
        title: 'Не всё сохранено в облаке',
        text: `Ещё не отправлено изменений: ${e.pending}. Проверь интернет и подожди пару секунд. Если выйти сейчас — эти изменения пропадут.`,
        ok: 'Выйти всё равно',
        cancel: 'Подождать',
        danger: true,
      })
      if (force) await signOut({ force: true })
    }
  }

  const syncText =
    sync.status === 'syncing'
      ? 'Синхронизация…'
      : sync.status === 'error'
        ? `Ошибка: ${sync.error}`
        : sync.at
          ? `Сохранено в облаке · ${new Date(sync.at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
          : navigator.onLine
            ? 'Ожидает'
            : 'Офлайн — сохранится, когда появится сеть'

  return (
    <div className="screen">
      <h1 className="title" style={{ marginBottom: 18 }}>
        Настройки
      </h1>

      <div className="section-label" style={{ marginTop: 0 }}>
        Оформление
      </div>
      <motion.div className="card pad" {...fade(0)}>
        <Segmented
          full
          value={s.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: 'system', label: 'Авто' },
            { value: 'light', label: 'Светлая' },
            { value: 'dark', label: 'Тёмная' },
          ]}
        />
      </motion.div>

      <div className="section-label">Учёба</div>
      <motion.div className="card" {...fade(1)}>
        <Row title="Заморозки в неделю" hint="Спасают стрик в пропущенный день">
          <Stepper value={s.freezesPerWeek} onChange={(freezesPerWeek) => updateSettings({ freezesPerWeek })} min={0} max={3} />
        </Row>
        <Row title="Запоминание" hint="Выше — чаще повторения, крепче память">
          <Segmented
            value={s.retention}
            onChange={(retention) => updateSettings({ retention })}
            options={[
              { value: 0.85, label: '85%' },
              { value: 0.9, label: '90%' },
              { value: 0.95, label: '95%' },
            ]}
          />
        </Row>
        <Row title="Автоозвучка английского">
          <Switch on={s.autoSpeak} onChange={(autoSpeak) => updateSettings({ autoSpeak })} />
        </Row>
        <Row title="Вибрация" hint="На Android">
          <Switch on={s.haptics} onChange={(haptics) => updateSettings({ haptics })} />
        </Row>
      </motion.div>

      <div className="section-label">Данные</div>
      <motion.div className="card" {...fade(2)}>
        <button className="settings-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => go('/import')}>
          <Icon name="upload" size={20} style={{ color: 'var(--accent)' }} />
          <div className="main">
            <div style={{ fontWeight: 600 }}>Импорт карточек</div>
            <div className="small faint">.apkg из Anki или .json — разложится по разделам сам</div>
          </div>
          <Icon name="chevron" size={18} style={{ color: 'var(--text-3)' }} />
        </button>
        <div className="settings-row">
          <Icon name="cloud" size={20} style={{ color: sync.status === 'error' ? 'var(--again)' : 'var(--good)' }} />
          <div className="main">
            <div style={{ fontWeight: 600 }}>Синхронизация</div>
            <div className="small faint" style={{ overflowWrap: 'anywhere' }}>
              {syncText}
              {waiting > 0 && ` · ждёт отправки: ${waiting}`}
            </div>
          </div>
          <button
            className="btn secondary sm"
            onClick={() =>
              syncNow()
                .then(() => toast('Синхронизировано'))
                .catch(() => {})
            }
          >
            Сейчас
          </button>
        </div>
        {held > 0 && (
          <div className="settings-row">
            <Icon name="layers" size={20} style={{ color: 'var(--hard)' }} />
            <div className="main">
              <div style={{ fontWeight: 600 }}>Только на этом устройстве</div>
              <div className="small faint">
                {held} {plural(held, 'запись', 'записи', 'записей')} не отправлено в облако
              </div>
            </div>
            <button className="btn primary sm" onClick={() => (releaseHeld(), toast('Отправляю в облако'))}>
              Отправить
            </button>
          </div>
        )}
        <Row title="Спрашивать перед синхронизацией" hint="После импорта и добавления карточек">
          <Switch on={s.askSync} onChange={(askSync) => updateSettings({ askSync })} />
        </Row>
        <button className="settings-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => go('/trash')}>
          <Icon name="trash" size={20} style={{ color: 'var(--text-2)' }} />
          <div className="main">
            <div style={{ fontWeight: 600 }}>Корзина и архив</div>
            <div className="small faint">Вернуть удалённое случайно</div>
          </div>
          <Icon name="chevron" size={18} style={{ color: 'var(--text-3)' }} />
        </button>
      </motion.div>

      <div className="section-label">Напоминания</div>
      <motion.div className="card" {...fade(3)}>
        <Reminders />
      </motion.div>

      <div className="section-label">Аккаунт</div>
      <motion.div className="card" {...fade(3)}>
        <div className="settings-row">
          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="main" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.email}
          </div>
          <button className="btn danger sm" onClick={() => logout()}>
            <Icon name="logout" size={16} /> Выйти
          </button>
        </div>
      </motion.div>
      <p className="small faint" style={{ textAlign: 'center', marginTop: 24 }}>
        My Habit Quizly · версия {__APP_VERSION__}
      </p>
    </div>
  )
}

function Row({ title, hint, children }) {
  return (
    <div className="settings-row">
      <div className="main">
        <div style={{ fontWeight: 600 }}>{title}</div>
        {hint && <div className="small faint">{hint}</div>}
      </div>
      {children}
    </div>
  )
}
