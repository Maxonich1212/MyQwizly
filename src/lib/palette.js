// Градиенты разделов — спокойные, без кислотности, читаются на светлой и тёмной теме
export const PALETTE = [
  { id: 'indigo', from: '#6366f1', to: '#8b5cf6' },
  { id: 'ocean', from: '#0ea5e9', to: '#6366f1' },
  { id: 'mint', from: '#10b981', to: '#0ea5e9' },
  { id: 'sunset', from: '#f97316', to: '#ec4899' },
  { id: 'rose', from: '#f43f5e', to: '#a855f7' },
  { id: 'amber', from: '#f59e0b', to: '#f97316' },
  { id: 'lime', from: '#84cc16', to: '#10b981' },
  { id: 'slate', from: '#64748b', to: '#475569' },
]

export const color = (id) => PALETTE.find((p) => p.id === id) || PALETTE[0]
export const gradient = (id, angle = 135) => {
  const c = color(id)
  return `linear-gradient(${angle}deg, ${c.from}, ${c.to})`
}

// Эмодзи для разделов — на iPhone они рисуются фирменными эмодзи Apple
export const EMOJIS = [
  '💼', '📱', '💻', '⌨️', '🧠', '💡', '🧩', '⚙️', '🛠️', '🐞', '🚀', '🎯',
  '📚', '📖', '📝', '✍️', '🎓', '🔤', '🗣️', '💬', '🇬🇧', '🇺🇸', '🇩🇪', '🇫🇷',
  '🇪🇸', '🇮🇹', '🇯🇵', '🇨🇳', '🌍', '🧪', '🔬', '🧬', '📊', '📈', '🧮', '💰',
  '🏆', '⭐️', '🔥', '⚡️', '🌱', '🍀', '🎨', '🎵', '🏋️', '🧘', '❤️', '🌙',
]

export function pickEmoji(name = '') {
  const n = name.toLowerCase()
  if (/англ|english|word|слов|vocab/.test(n)) return '🇬🇧'
  if (/собес|interview|ios|swift|uikit/.test(n)) return '💼'
  return '📚'
}
