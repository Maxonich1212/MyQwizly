import { motion } from 'framer-motion'
import { useStore, updateSettings, syncNow, signOut } from '../lib/store'
import { go } from '../lib/ui'
import Icon from '../components/Icon'
import { Segmented, Stepper, Switch, soft, toast } from '../components/ui'

const fade = (i) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { ...soft, delay: 0.04 * i } })

export default function Settings() {
  const s = useStore((st) => st.settings)
  const user = useStore((st) => st.user)
  const sync = useStore((st) => st.sync)

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
        <Row title="Цель на день" hint="Сколько карточек засчитывает день в стрик">
          <Stepper value={s.dailyGoal} onChange={(dailyGoal) => updateSettings({ dailyGoal })} min={5} max={500} step={5} />
        </Row>
        <Row title="Новых в день" hint="На каждую колоду">
          <Stepper value={s.newPerDay} onChange={(newPerDay) => updateSettings({ newPerDay })} min={0} max={200} step={5} />
        </Row>
        <Row title="Цель раздела" hint="По умолчанию для стрика раздела">
          <Stepper value={s.sectionGoal} onChange={(sectionGoal) => updateSettings({ sectionGoal })} min={1} max={300} step={5} />
        </Row>
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
          <button className="btn danger sm" onClick={() => confirm('Выйти из аккаунта? Данные останутся в облаке.') && signOut()}>
            <Icon name="logout" size={16} /> Выйти
          </button>
        </div>
      </motion.div>
      <p className="small faint" style={{ textAlign: 'center', marginTop: 24 }}>
        MyQwizly · интервальные повторения FSRS
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
