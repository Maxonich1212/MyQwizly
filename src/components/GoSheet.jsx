import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Rocket, Shuffle } from 'lucide-react'
import { useStore } from '../lib/store'
import { countInScope } from '../lib/queue'
import { plural } from '../lib/day'
import { go } from '../lib/ui'
import { Sheet } from './ui'
import { liquid } from './fluid'

const PRESETS = [5, 10, 20, 30, 50]

function parse(scope) {
  if (scope.startsWith('s:')) return { sectionId: scope.slice(2) }
  if (scope.startsWith('d:')) return { deckId: scope.slice(2) }
  return { all: true }
}

// «Погнали»: выбираешь, сколько карточек повторить, — приложение выдаёт столько случайных
export default function GoSheet({ open, onClose, scope = 'all', title = 'Погнали' }) {
  const notes = useStore((s) => s.notes)
  const decks = useStore((s) => s.decks)
  const total = useMemo(() => countInScope({ notes, decks }, parse(scope)), [notes, decks, scope])
  const [n, setN] = useState(10)

  useEffect(() => {
    if (open) setN(Math.min(Number(localStorage.getItem('mq-go-n')) || 10, Math.max(1, total)))
  }, [open, total])

  const start = () => {
    const count = Math.max(1, Math.min(total, n || 1))
    localStorage.setItem('mq-go-n', String(count))
    onClose()
    go(`/study/go:${count}:${scope}`)
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <motion.div className="go-badge" initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
          <Rocket size={30} />
        </motion.div>
        <h3 style={{ margin: '0 0 4px' }}>{title}</h3>
        <p className="muted small" style={{ margin: '0 0 18px' }}>
          Сколько карточек повторить? Выдам случайные из {total} {plural(total, 'карточки', 'карточек', 'карточек')}.
        </p>
      </div>

      <div className="go-presets">
        {PRESETS.filter((p) => p < total).map((p) => (
          <motion.button key={p} className={n === p ? 'on' : ''} whileTap={{ scale: 0.9 }} transition={liquid} onClick={() => setN(p)}>
            {p}
          </motion.button>
        ))}
        <motion.button className={n === total ? 'on' : ''} whileTap={{ scale: 0.9 }} transition={liquid} onClick={() => setN(total)}>
          Все · {total}
        </motion.button>
      </div>

      <label className="go-custom">
        <Shuffle size={17} />
        <span>Своё число</span>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max={total}
          value={n || ''}
          onChange={(e) => setN(Math.max(0, Math.min(total, Number(e.target.value) || 0)))}
          onKeyDown={(e) => e.key === 'Enter' && start()}
        />
      </label>

      <motion.button className="btn primary block shine" style={{ height: 56, marginTop: 16 }} whileTap={{ scale: 0.97 }} disabled={!total || !n} onClick={start}>
        <Rocket size={18} /> Вперёд · {Math.min(total, n || 0)}
      </motion.button>
      {!total && <div className="small faint" style={{ textAlign: 'center', marginTop: 10 }}>Здесь пока нет карточек</div>}
    </Sheet>
  )
}
