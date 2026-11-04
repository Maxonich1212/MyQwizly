import { stripHtml } from './check'

let voices = []
function loadVoices() {
  voices = window.speechSynthesis?.getVoices() || []
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}

const isLatin = (s) => /[a-z]/i.test(s) && !/[а-яё]/i.test(s)

function pickVoice(lang) {
  const pref = lang === 'en-US' ? ['Samantha', 'Google US English', 'Ava', 'Allison', 'Alex'] : ['Milena', 'Google русский']
  const list = voices.filter((v) => v.lang.replace('_', '-').startsWith(lang.slice(0, 2)))
  return pref.map((p) => list.find((v) => v.name.includes(p))).find(Boolean) || list.find((v) => v.lang.startsWith(lang)) || list[0]
}

export const canSpeak = () => typeof window !== 'undefined' && !!window.speechSynthesis

export function speak(text, opts = {}) {
  if (!canSpeak()) return
  const clean = stripHtml(text).replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
  if (!clean) return
  const lang = opts.lang || (isLatin(clean) ? 'en-US' : 'ru-RU')
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(clean)
  u.lang = lang
  u.rate = opts.rate || 0.92
  const v = pickVoice(lang)
  if (v) u.voice = v
  window.speechSynthesis.speak(u)
}

export const englishSide = (a, b) => (isLatin(stripHtml(a)) ? a : isLatin(stripHtml(b)) ? b : null)
