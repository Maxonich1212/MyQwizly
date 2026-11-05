// IPA → «как читается по-русски» с ударением. Приближение для запоминания, а не точная фонетика:
// able /ˈeɪbl/ → э́йбл, throughput /ˈθruːpʊt/ → сру́пут. Точный звук — по кнопке озвучки.

const VOWELS = 'аэиоуыеёюя'
const ACCENT = '́'

// Длинные последовательности — первыми (сортируем по длине ниже)
const MULTI = {
  tʃ: 'ч', ʧ: 'ч', dʒ: 'дж', ʤ: 'дж',
  eɪ: 'эй', aɪ: 'ай', ɔɪ: 'ой', aʊ: 'ау', əʊ: 'оу', oʊ: 'оу',
  ɪə: 'иэ', eə: 'эа', ɛə: 'эа', ʊə: 'уэ',
  ɜːr: 'ёр', ɜː: 'ё', iː: 'и', ɑː: 'а', ɔː: 'о', uː: 'у',
  ts: 'тс', dz: 'дз',
}

const SINGLE = {
  ɪ: 'и', i: 'и', e: 'э', ɛ: 'э', æ: 'э', ɑ: 'а', a: 'а', ʌ: 'а', ɒ: 'о', ɔ: 'о', o: 'о', ʊ: 'у', u: 'у', ə: 'э', ɜ: 'ё', ɐ: 'а', ɚ: 'эр', ɝ: 'ёр',
  p: 'п', b: 'б', t: 'т', d: 'д', k: 'к', g: 'г', ɡ: 'г', f: 'ф', v: 'в', θ: 'с', ð: 'з', s: 'с', z: 'з', ʃ: 'ш', ʒ: 'ж', h: 'х', x: 'х',
  m: 'м', n: 'н', l: 'л', ɫ: 'л', r: 'р', ɹ: 'р', ɾ: 'д', j: 'й', w: 'в', c: 'к', q: 'к',
}

const SKIP = new Set(['ˌ', '.', '‿', 'ʰ', 'ʔ', 'ː', 'ˑ', '͡', '͜', '̩', '̍', '̯', '̃'])
const KEYS = [...Object.keys(MULTI)].sort((a, b) => b.length - a.length)
const IOT = { у: 'ю', а: 'я', э: 'е', о: 'ё' }

function tokenize(word) {
  const toks = []
  let stress = false
  for (let i = 0; i < word.length; ) {
    const ch = word[i]
    if (ch === 'ˈ' || ch === "'" || ch === '’') {
      stress = true
      i++
      continue
    }
    if (SKIP.has(ch) || /[̀-ͯ]/.test(ch)) {
      i++
      continue
    }
    const multi = KEYS.find((k) => word.startsWith(k, i))
    if (multi) {
      toks.push({ ru: MULTI[multi], stress })
      stress = false
      i += multi.length
      continue
    }
    if (ch === 'ŋ') {
      // перед k/g — просто «н» (finger → фингэ), иначе «нг» (sing → синг)
      const nxt = word.slice(i + 1).replace(/^[ˈˌ]/, '')[0]
      toks.push({ ru: nxt === 'g' || nxt === 'ɡ' || nxt === 'k' ? 'н' : 'нг', stress })
      stress = false
      i++
      continue
    }
    if (ch in SINGLE) {
      toks.push({ ru: SINGLE[ch], stress })
      stress = false
    }
    i++
  }
  return toks
}

function convertWord(word) {
  const toks = tokenize(word)
  // «й» + гласный → я / ю / е / ё
  const merged = []
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    const nx = toks[i + 1]
    if (t.ru === 'й' && nx && IOT[nx.ru[0]]) {
      merged.push({ ru: IOT[nx.ru[0]] + nx.ru.slice(1), stress: t.stress || nx.stress })
      i++
    } else merged.push(t)
  }
  // Ударение — знак над первой гласной после ˈ (ё всегда ударная, ей знак не нужен)
  let pending = false
  let out = ''
  for (const t of merged) {
    if (t.stress) pending = true
    if (pending && VOWELS.includes(t.ru[0])) {
      out += t.ru[0] === 'ё' ? t.ru : t.ru[0] + ACCENT + t.ru.slice(1)
      pending = false
    } else out += t.ru
  }
  return out
}

// raw — как записано на карточке: «[ˈeɪbl]», «/ˈeɪbl/», «ˈeɪbl, ˈeɪb(ə)l», «kʌm ʌp wɪð»
export function ipaToRu(raw) {
  if (!raw) return null
  let s = String(raw).replace(/<[^>]*>/g, ' ')
  if (/[а-яё]/i.test(s)) return null // уже не IPA
  s = s.replace(/\b(UK|US|BrE|AmE|Br|Am)\b\s*:?/gi, ' ').replace(/\(r\)/g, '').replace(/[()]/g, '')
  // Если вариантов несколько (через , ; | /) — берём первый
  const first = s
    .replace(/[[\]]/g, ' ')
    .split(/[|/,;]/)
    .map((x) => x.trim())
    .find(Boolean)
  if (!first) return null
  const out = first
    .split(/\s+/)
    .map(convertWord)
    .filter(Boolean)
    .join(' ')
  return out || null
}

// Показываемая запись без квадратных скобок и тегов
export function cleanIpa(raw) {
  return String(raw || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
