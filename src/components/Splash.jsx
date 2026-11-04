import { motion } from 'framer-motion'
import Logo from './Logo'

// Загрузочный экран: та же разметка, что и заглушка в index.html (стили там же), — переход незаметен.
// Ширина полосы — CSS-переменная --boot-p, её двигают этапы загрузки (window.__bootSet)
export default function Splash() {
  return (
    <motion.div className="splash" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}>
      <div className="splash-glow" />
      <div className="splash-logo" style={{ animation: 'none' }}>
        <Logo size={56} animated />
      </div>
      <div className="splash-name" style={{ animation: 'none' }}>
        My Habit Quizly
      </div>
      <div className="splash-bar" style={{ animation: 'none' }}>
        <i />
      </div>
    </motion.div>
  )
}
