import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { liquid } from './fluid'

// Свои диалоги вместо confirm/alert/prompt: системные окна в установленном PWA
// и встроенных браузерах бывают заблокированы и молча возвращают «нет»
let show = null
const queue = []

function ask(opts) {
  return new Promise((resolve) => {
    const d = { ok: 'OK', cancel: 'Отмена', danger: false, input: null, placeholder: '', ...opts, resolve }
    if (show) show(d)
    else queue.push(d)
  })
}

export const confirmDialog = (opts) => ask(opts)
export const promptDialog = (opts) => ask({ ...opts, input: opts.value ?? '' })

export function DialogHost() {
  const [d, setD] = useState(null)
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    show = (next) => {
      setD(next)
      setValue(next.input ?? '')
    }
    if (queue.length) show(queue.shift())
    return () => {
      show = null
    }
  }, [])

  useEffect(() => {
    if (d?.input != null) setTimeout(() => inputRef.current?.focus(), 80)
  }, [d])

  function close(ok) {
    d.resolve(d.input != null ? (ok ? value : null) : ok)
    setD(null)
    if (queue.length) setTimeout(() => show?.(queue.shift()), 180)
  }

  return createPortal(
    <AnimatePresence>
      {d && (
        <motion.div key="dlg" className="dialog-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => close(false)}>
          <motion.div className="dialog" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.86, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }} transition={liquid}>
            {d.title && <h3>{d.title}</h3>}
            {d.text && <p>{d.text}</p>}
            {d.input != null && (
              <input
                ref={inputRef}
                className="input"
                value={value}
                placeholder={d.placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && close(true)}
                style={{ marginBottom: 14 }}
              />
            )}
            <div className="dialog-actions">
              {d.cancel && (
                <button className="btn secondary" onClick={() => close(false)}>
                  {d.cancel}
                </button>
              )}
              <button className={`btn ${d.danger ? 'danger-solid' : 'primary'}`} onClick={() => close(true)}>
                {d.ok}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
