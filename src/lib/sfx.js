import { getState } from './store'

// Звуки ответов: синтез на лету (Web Audio), файлов нет. Тихие, мягкие, без резких «баззеров»:
// ok — восходящий двойной «дзынь», meh — один нейтральный тон, bad — низкий нисходящий «ду-дум»
let ctx = null

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    try {
      // iOS: смешиваться с чужим звуком (музыка не прерывается). Беззвучный режим при этом звук отключает — так и задумано
      if (navigator.audioSession) navigator.audioSession.type = 'ambient'
    } catch {
      /* старый Safari */
    }
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(c, freq, at, dur, vol, type = 'sine') {
  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const gain = c.createGain()
  const lp = c.createBiquadFilter()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  // Плавное нарастание и затухание — без щелчков
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.014)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  lp.type = 'lowpass'
  lp.frequency.value = 3000
  osc.connect(gain)
  gain.connect(lp)
  lp.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

const LEVEL = { low: 0.5, mid: 0.9 }

export function playSound(kind) {
  const s = getState().settings
  if (s.sound === false) return
  const c = audio()
  if (!c) return
  const v = 0.075 * (LEVEL[s.soundLevel] ?? LEVEL.mid)
  if (kind === 'ok') {
    tone(c, 784, 0, 0.26, v) // соль
    tone(c, 1175, 0.09, 0.34, v * 0.85) // ре выше — «верно»
  } else if (kind === 'meh') {
    tone(c, 587, 0, 0.24, v * 0.85) // нейтральное «почти»
  } else {
    // Низкие синусы плохо слышны на динамике телефона — берём треугольник, он мягко «добавляет» обертонов
    tone(c, 330, 0, 0.22, v * 1.15, 'triangle')
    tone(c, 247, 0.11, 0.32, v * 1.15, 'triangle')
  }
}

export const soundFor = (rating) => (rating === 1 ? 'bad' : rating === 2 ? 'meh' : 'ok')
