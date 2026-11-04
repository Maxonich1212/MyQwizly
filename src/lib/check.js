// Проверка ответов: слова — с прощением опечаток, вопросы собеседования — по ключевым словам

export function stripHtml(s = '') {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export function normalize(s) {
  return stripHtml(s)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a, b) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

function variants(answer) {
  return stripHtml(answer)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/[,;/\n]|\s+or\s+|\s+или\s+/i)
    .map((v) => normalize(v).replace(/^(to|a|an|the)\s+/, ''))
    .filter(Boolean)
}

// 'exact' | 'close' (опечатка) | 'wrong'
export function checkVocab(input, answer) {
  const got = normalize(input).replace(/^(to|a|an|the)\s+/, '')
  if (!got) return { verdict: 'empty', best: null }
  let best = { score: 0, text: '' }
  for (const v of variants(answer)) {
    const score = 1 - levenshtein(got, v) / Math.max(got.length, v.length)
    if (score > best.score) best = { score, text: v }
  }
  const verdict = best.score >= 0.999 ? 'exact' : best.score >= 0.78 ? 'close' : 'wrong'
  return { verdict, best: best.text, score: best.score }
}

const STOP = new Set(
  `это этот эта эти того тому того чтобы когда тогда если также более менее очень можно нужно который которая которые которого
  который потому поэтому только через после перед между всегда всего везде здесь там где как так для при без над под или либо
  есть быть было были будет будут него неё нее них ними свой своя свои своих каждый каждая любой любая другой другие
  самый самая такой такая такие весь вся все всех этого этой этих чем при него этом этим этих
  this that these those with from have has had will would should could which what when where there their them they then than
  into onto about above below also only just very more most some such each every other another being been were does done
  your yours ours here using used`.split(/\s+/),
)

function tokens(text) {
  return stripHtml(text)
    .replace(/```[a-z]*\n?/gi, ' ')
    .match(/[\p{L}_][\p{L}\p{N}_]*/gu) || []
}

// Русская морфология: сравниваем по основе (первые 5 букв), короткие слова — целиком
const stem = (w) => {
  const l = w.toLowerCase().replace(/ё/g, 'е')
  return l.length > 6 ? l.slice(0, Math.max(5, l.length - 3)) : l
}

export function keywordCoverage(userAnswer, reference) {
  const seen = new Set()
  const keys = []
  // Идентификаторы из примеров кода — не то, что нужно проговорить на собеседовании
  const prose = reference.replace(/```[\s\S]*?```/g, ' ').replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
  for (const w of tokens(prose)) {
    const l = w.toLowerCase()
    if (w.length < 4 || STOP.has(l)) continue
    const s = stem(w)
    if (seen.has(s)) continue
    seen.add(s)
    keys.push({ word: w, stem: s })
  }
  const user = tokens(userAnswer).map(stem)
  const hits = []
  const misses = []
  for (const k of keys.slice(0, 24)) {
    const ok = user.some((u) => u === k.stem || (u.length >= 5 && (u.startsWith(k.stem) || k.stem.startsWith(u))))
    ;(ok ? hits : misses).push(k.word)
  }
  const total = hits.length + misses.length
  return { hits, misses, ratio: total ? hits.length / total : 0 }
}
