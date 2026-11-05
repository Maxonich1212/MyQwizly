import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { ipaToRu, cleanIpa } from '../lib/ipa'
import { Sheet } from './ui'

// [символ, как читать, слово-пример, его транскрипция] — «как читается» для примеров считает тот же конвертер,
// поэтому шпаргалка не расходится с тем, что показывается на карточках
const GUIDE = [
  {
    title: 'Ударение и длина',
    rows: [
      ['ˈ', 'ударение — на слог сразу после знака', 'able', 'ˈeɪbl'],
      ['ː', 'звук долгий — тяни его', 'see', 'siː'],
    ],
  },
  {
    title: 'Гласные',
    rows: [
      ['ɪ', 'короткое «и»', 'sit', 'sɪt'],
      ['iː', 'долгое «и»', 'see', 'siː'],
      ['e', '«э»', 'bed', 'bed'],
      ['æ', 'широкое «э» — рот открыт шире', 'cat', 'kæt'],
      ['ɑː', 'протяжное «а»', 'father', 'ˈfɑːðə'],
      ['ʌ', 'короткое «а»', 'cup', 'kʌp'],
      ['ɒ', 'короткое «о»', 'hot', 'hɒt'],
      ['ɔː', 'протяжное «о»', 'more', 'mɔː'],
      ['ʊ', 'короткое «у»', 'book', 'bʊk'],
      ['uː', 'долгое «у»', 'food', 'fuːd'],
      ['ə', 'слабый безударный «э»', 'about', 'əˈbaʊt'],
      ['ɜː', 'звук «ё», как в «бёрд»', 'bird', 'bɜːd'],
    ],
  },
  {
    title: 'Сочетания гласных — скользишь от первого звука ко второму',
    rows: [
      ['eɪ', '«эй»', 'day', 'deɪ'],
      ['aɪ', '«ай»', 'my', 'maɪ'],
      ['ɔɪ', '«ой»', 'boy', 'bɔɪ'],
      ['aʊ', '«ау»', 'now', 'naʊ'],
      ['əʊ · oʊ', '«оу»', 'go', 'ɡəʊ'],
      ['ɪə', '«иэ»', 'near', 'nɪə'],
      ['eə', '«эа»', 'hair', 'heə'],
    ],
  },
  {
    title: 'Согласные, которых нет в русском',
    rows: [
      ['θ', '«с», язык между зубами', 'think', 'θɪŋk'],
      ['ð', '«з», язык между зубами', 'this', 'ðɪs'],
      ['ŋ', 'носовой «нг»', 'sing', 'sɪŋ'],
      ['w', '«в» губами трубочкой, как в «у»', 'water', 'ˈwɔːtə'],
      ['r', 'мягкое «р» без раскатов', 'red', 'red'],
      ['h', 'лёгкий выдох «х»', 'hat', 'hæt'],
      ['ʃ', '«ш»', 'ship', 'ʃɪp'],
      ['ʒ', '«ж»', 'vision', 'ˈvɪʒn'],
      ['tʃ', '«ч»', 'chair', 'tʃeə'],
      ['dʒ', '«дж»', 'job', 'dʒɒb'],
      ['j', '«й»', 'yes', 'jes'],
    ],
  },
]

export function IpaGuide({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Как читать транскрипцию">
      <p className="muted small" style={{ margin: '-8px 0 14px' }}>
        Транскрипция показывает звуки, а не буквы. Русская подсказка «читается» приблизительная — она помогает запомнить звучание, а точный звук лучше послушать кнопкой 🔊.
      </p>
      {GUIDE.map((g) => (
        <div key={g.title} style={{ marginBottom: 14 }}>
          <div className="mono-label" style={{ margin: '0 2px 8px' }}>
            {g.title}
          </div>
          <div className="card list" style={{ boxShadow: 'none' }}>
            {g.rows.map(([sym, hint, word, ipa]) => (
              <div key={sym} className="guide-row">
                <b className={`guide-sym ${sym === 'ˈ' || sym === 'ː' ? 'big' : ''}`}>{sym}</b>
                <span className="guide-hint">{hint}</span>
                <span className="guide-ex">
                  <em>{word}</em>
                  <small>
                    [{ipa}] → {ipaToRu(ipa)}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  )
}

// Транскрипция на карточке: сама запись, под ней «читается: э́йбл» с ударением и кнопка со шпаргалкой
export default function Transcription({ ipa }) {
  const [help, setHelp] = useState(false)
  const clean = cleanIpa(ipa)
  const ru = useMemo(() => ipaToRu(clean), [clean])
  if (!clean) return null
  return (
    <div className="transcr">
      <div className="transcr-ipa">{clean}</div>
      {ru && (
        <div className="transcr-ru">
          <small>читается</small>
          <b>{ru}</b>
        </div>
      )}
      <button className="transcr-help" onClick={() => setHelp(true)}>
        <Info size={13} /> как читать транскрипцию
      </button>
      <IpaGuide open={help} onClose={() => setHelp(false)} />
    </div>
  )
}
