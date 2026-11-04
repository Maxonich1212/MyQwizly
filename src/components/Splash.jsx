import { motion } from 'framer-motion'
import Logo from './Logo'

// Загрузочный экран: графитовый знак, точки галочки загораются по очереди.
// Выглядит так же, как заглушка в index.html, — переход от неё незаметен
export default function Splash() {
  return (
    <motion.div className="splash" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}>
      <div className="splash-logo">
        <Logo size={56} animated />
      </div>
    </motion.div>
  )
}
