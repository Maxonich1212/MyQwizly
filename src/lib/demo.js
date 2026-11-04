// Только для локальной разработки (?demo): примеры карточек и 2 месяца истории, без входа и синхронизации
import { gradeNote, dirsFor } from './srs'
import { dayKey } from './day'

const QA = [
  ['Чем struct отличается от class в Swift?', 'struct — **тип-значение**: копируется при присваивании, нет наследования, хранится обычно на стеке.\n\nclass — **ссылочный тип**: есть наследование, deinit, подсчёт ссылок (ARC).\n\n```swift\nstruct Point { var x = 0 }\nvar a = Point()\nvar b = a\nb.x = 5 // a.x всё ещё 0\n```'],
  ['Что такое ARC и как избежать retain cycle?', 'ARC — автоматический подсчёт ссылок. Объект освобождается, когда счётчик сильных ссылок падает до нуля.\n\nЦикл возникает, когда два объекта держат друг друга сильно. Решение — `weak` или `unowned`:\n\n```swift\nlazy var handler = { [weak self] in\n    self?.update()\n}\n```'],
  ['Что такое GCD и чем serial queue отличается от concurrent?', 'GCD — Grand Central Dispatch, API для работы с очередями задач.\n\n- **serial** — задачи выполняются по одной, в порядке добавления\n- **concurrent** — задачи могут выполняться параллельно\n\n`DispatchQueue.main` — serial, для UI.'],
  ['Что делает actor в Swift Concurrency?', 'actor — ссылочный тип, который защищает своё изменяемое состояние от гонок данных: доступ извне только через `await`, внутри — по одной задаче за раз.'],
  ['Жизненный цикл UIViewController', 'loadView → viewDidLoad → viewWillAppear → viewIsAppearing → viewDidAppear → viewWillDisappear → viewDidDisappear. Для layout — viewWillLayoutSubviews / viewDidLayoutSubviews.'],
  ['Что такое @State и @Binding в SwiftUI?', '`@State` — источник истины, приватное состояние вью, хранится вне структуры.\n\n`@Binding` — двусторонняя ссылка на чужое состояние без владения им.'],
  ['Чем escaping-замыкание отличается от non-escaping?', 'non-escaping вызывается до возврата из функции (по умолчанию). `@escaping` может быть сохранено и вызвано позже — например, completion handler сетевого запроса. В нём нужно явно писать `self`.'],
  ['Что такое протокол-ориентированное программирование?', 'Подход, где поведение описывается протоколами с extension-реализациями по умолчанию, а не наследованием классов. Работает и для value-типов.'],
]

const WORDS = [
  ['come up with', 'придумать, предложить', '[kʌm ʌp wɪð]', 'She came up with a brilliant idea.'],
  ['throughput', 'пропускная способность', '[ˈθruːpʊt]', 'We need to increase the throughput of the API.'],
  ['to tackle', 'взяться за, решать', '[ˈtækl]', "Let's tackle this bug first."],
  ['trade-off', 'компромисс', '[ˈtreɪd ɒf]', 'Every architecture has its trade-offs.'],
  ['eventually', 'в конце концов', '[ɪˈventʃuəli]', 'The tests eventually passed.'],
  ['to deploy', 'развернуть, выкатить', '[dɪˈplɔɪ]', 'We deploy to production every Friday.'],
  ['reliable', 'надёжный', '[rɪˈlaɪəbl]', 'The service is fast and reliable.'],
  ['to figure out', 'разобраться, понять', '[ˈfɪɡər aʊt]', 'I finally figured out the problem.'],
  ['bottleneck', 'узкое место', '[ˈbɒtlnek]', 'The database is the main bottleneck.'],
  ['straightforward', 'простой, понятный', '[ˌstreɪtˈfɔːwəd]', 'The fix was pretty straightforward.'],
  ['to estimate', 'оценить', '[ˈestɪmeɪt]', 'Can you estimate this task?'],
  ['requirement', 'требование', '[rɪˈkwaɪəmənt]', 'Read the requirements carefully.'],
]

export function demoData() {
  const id = () => crypto.randomUUID()
  const t0 = Date.now()
  const s1 = { id: id(), name: 'Собеседование iOS', emoji: '💼', color: 'indigo', sort: 1, goal: null, deleted: false, updated_at: t0 }
  const s2 = { id: id(), name: 'Английский', emoji: '🇬🇧', color: 'mint', sort: 2, goal: null, deleted: false, updated_at: t0 }
  const d1 = { id: id(), section_id: s1.id, name: 'Swift и UIKit', kind: 'qa', sort: 1, deleted: false, updated_at: t0 }
  const d2 = { id: id(), section_id: s2.id, name: 'IT-лексика', kind: 'vocab', sort: 1, deleted: false, updated_at: t0 }
  const notes = {}
  QA.forEach(([front, back], i) => {
    const n = { id: id(), deck_id: d1.id, front, back, extra: {}, format: 'md', tags: [], srs: {}, suspended: false, deleted: false, created_at: t0 + i, updated_at: t0 }
    notes[n.id] = n
  })
  WORDS.forEach(([front, back, transcription, example], i) => {
    const n = { id: id(), deck_id: d2.id, front, back, extra: { transcription, example }, format: 'md', tags: [], srs: {}, suspended: false, deleted: false, created_at: t0 + 100 + i, updated_at: t0 }
    notes[n.id] = n
  })
  const decks = { [d1.id]: d1, [d2.id]: d2 }

  // История: ~2 месяца, иногда пропуски, оценки в основном «Хорошо»
  const reviews = {}
  const list = Object.values(notes)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let back = 62; back >= 1; back--) {
    if (rnd() < 0.18) continue
    const base = new Date()
    base.setDate(base.getDate() - back)
    base.setHours(19, 0, 0, 0)
    const count = 8 + Math.floor(rnd() * 24)
    for (let k = 0; k < count; k++) {
      const n = list[Math.floor(rnd() * list.length)]
      const deck = decks[n.deck_id]
      const dirs = dirsFor(deck)
      const dir = dirs[Math.floor(rnd() * dirs.length)]
      const when = new Date(+base + k * 40_000)
      const r = rnd()
      const rating = r < 0.12 ? 1 : r < 0.25 ? 2 : r < 0.9 ? 3 : 4
      const g = gradeNote(n, dir, rating, 0.9, when)
      n.srs = g.srs
      const rid = id()
      reviews[rid] = { id: rid, note_id: n.id, deck_id: deck.id, section_id: deck.section_id, dir, rating, state: g.prevState, ms: 6000 + Math.floor(rnd() * 20000), day: dayKey(+when), reviewed_at: +when, updated_at: +when }
    }
  }
  // Часть карточек пусть будет к повторению сегодня
  list.slice(0, 5).forEach((n) => {
    for (const c of Object.values(n.srs)) c.due = Date.now() - 3600e3
  })
  // Ещё несколько новых слов
  ;['to leverage|использовать, задействовать', 'deadline|крайний срок', 'to refactor|переписать, отрефакторить'].forEach((p, i) => {
    const [front, back] = p.split('|')
    const n = { id: id(), deck_id: d2.id, front, back, extra: {}, format: 'md', tags: [], srs: {}, suspended: false, deleted: false, created_at: t0 + 500 + i, updated_at: t0 }
    notes[n.id] = n
  })
  // Привычки с историей ~3 месяца
  const habits = {}
  const habit_logs = {}
  const HB = [
    { name: 'Утренняя зарядка', icon: 'activity', color: '#f4c34a', p: 0.8, category: 'Утро' },
    { name: 'Теория iOS', icon: 'study', color: '#f2706b', p: 0.6, category: 'Учёба', description: 'Глава из Swift Book' },
    { name: 'LeetCode', icon: 'code', color: '#6fd98a', p: 0.7, category: 'Учёба', description: 'Одна задача в день', repeat: { type: 'days', days: [0, 1, 2, 3, 4] } },
    { name: 'Вода', icon: 'water', color: '#5ccbe8', p: 0.75, tracking: 'count', target: 8, unit: 'стак.', category: 'Здоровье' },
    { name: 'Без соцсетей', icon: 'screen', color: '#a284f5', p: 0.15, kind: 'quit', category: 'Здоровье' },
  ]
  HB.forEach((x, i) => {
    const h = { id: id(), name: x.name, description: x.description || null, icon: x.icon, color: x.color, kind: x.kind || 'build', repeat: x.repeat || { type: 'daily' }, tracking: x.tracking || 'check', target: x.target || 1, unit: x.unit || null, reminder: null, category: x.category, sort: i, archived: false, deleted: false, created_at: Date.now() - (60 + i * 8) * 864e5, updated_at: t0 }
    habits[h.id] = h
    for (let b = 70; b >= 1; b--) {
      const d = new Date()
      d.setDate(d.getDate() - b)
      if (rnd() > x.p) continue
      const day = dayKey(+d + 5 * 3600e3)
      const value = h.tracking === 'count' ? 3 + Math.floor(rnd() * 6) : 1
      habit_logs[`${h.id}:${day}`] = { id: `${h.id}:${day}`, habit_id: h.id, day, value, note: null, deleted: false, updated_at: t0 }
    }
  })
  return { sections: { [s1.id]: s1, [s2.id]: s2 }, decks, notes, reviews, habits, habit_logs }
}
