import { motion } from 'framer-motion'
import { CloudUpload, Smartphone } from 'lucide-react'
import { useStore, resolveSync } from '../lib/store'
import { Sheet } from './ui'
import { liquid } from './fluid'

// Вопрос после импорта или добавления карточек: отправить их на все устройства или оставить здесь
export default function SyncAsk() {
  const ask = useStore((s) => s.syncAsk)
  return (
    <Sheet open={!!ask} onClose={() => resolveSync(false)}>
      {ask && (
        <div style={{ textAlign: 'center' }}>
          <motion.div
            style={{ width: 76, height: 76, borderRadius: '50%', margin: '6px auto 14px', display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' }}
            initial={{ scale: 0.5, y: 10 }}
            animate={{ scale: 1, y: [0, -4, 0] }}
            transition={{ scale: liquid, y: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' } }}
          >
            <CloudUpload size={34} />
          </motion.div>
          <h3 style={{ marginBottom: 6 }}>Синхронизировать со всеми устройствами?</h3>
          <p className="muted" style={{ margin: '0 0 20px' }}>
            {ask.label}. Отправить в облако — они появятся на телефоне и компьютере и попадут в ночной бэкап.
          </p>
          <button className="btn primary block" onClick={() => resolveSync(true)}>
            <CloudUpload size={18} /> Да, синхронизировать
          </button>
          <button className="btn secondary block" style={{ marginTop: 10 }} onClick={() => resolveSync(false)}>
            <Smartphone size={18} /> Нет, только на этом устройстве
          </button>
          <div className="small faint" style={{ marginTop: 12 }}>
            Отправить позже можно в Настройках → Синхронизация
          </div>
        </div>
      )}
    </Sheet>
  )
}
