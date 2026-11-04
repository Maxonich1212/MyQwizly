import { motion } from 'framer-motion'
import { Layers } from 'lucide-react'

const COLORS = ['#f4c34a', '#f2706b', '#6fd98a', '#5ab1f5', '#a284f5', '#ec7bb8', '#5ccbe8']

// Загрузочный экран: тот же вид, что и встроенная в index.html заглушка, — переход незаметен
export default function Splash() {
  return (
    <motion.div className="splash" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}>
      <motion.div className="splash-logo" animate={{ scale: [1, 1.06, 1], borderRadius: ['30%', '42%', '30%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
        <Layers size={34} color="#fff" strokeWidth={2.2} />
      </motion.div>
      <div className="splash-dots">
        {COLORS.map((c, i) => (
          <i key={c} style={{ '--c': c, animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
    </motion.div>
  )
}
