// Знак приложения: сетка 7×7 как тепловая карта привычек, «зажжённые» точки складываются в галочку.
// animated — точки галочки загораются по очереди (используется на заставке)
const N = 7
const LIT = [
  [0, 3],
  [1, 4],
  [2, 5],
  [3, 4],
  [4, 3],
  [5, 2],
  [6, 1],
]
const order = new Map(LIT.map(([c, r], i) => [`${c},${r}`, i]))

export default function Logo({ size = 40, animated = false, dim = 0.14 }) {
  const pitch = 100 / N
  const s = pitch * 0.76
  const off = (pitch - s) / 2
  const cells = []
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const i = order.get(`${c},${r}`)
      const lit = i !== undefined
      cells.push(
        <rect
          key={`${c}-${r}`}
          x={c * pitch + off}
          y={r * pitch + off}
          width={s}
          height={s}
          rx={s * 0.3}
          fill="#fff"
          className={lit && animated ? 'logo-lit' : undefined}
          style={lit ? (animated ? { animationDelay: `${i * 0.11}s` } : undefined) : { opacity: dim }}
        />,
      )
    }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {cells}
    </svg>
  )
}
