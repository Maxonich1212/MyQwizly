// Минимальная обёртка над IndexedDB: по стору на таблицу + meta (ключ-значение) + media (blob)
const DB_NAME = 'myqwizly'
export const STORES = ['sections', 'decks', 'notes', 'reviews', 'habits', 'habit_logs']
let dbp = null

function open() {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    // v2: привычки. Создаём только недостающие сторы — старые данные остаются
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' })
      for (const s of ['meta', 'media']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error)
  })
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getAll(store) {
  const db = await open()
  return wrap(db.transaction(store).objectStore(store).getAll())
}

export async function putMany(store, rows) {
  if (!rows.length) return
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  const os = tx.objectStore(store)
  for (const r of rows) os.put(r)
  return done(tx)
}

export async function metaGet(key) {
  const db = await open()
  return wrap(db.transaction('meta').objectStore('meta').get(key))
}

export async function metaSet(key, value) {
  const db = await open()
  const tx = db.transaction('meta', 'readwrite')
  tx.objectStore('meta').put(value, key)
  return done(tx)
}

export async function mediaGet(name) {
  const db = await open()
  return wrap(db.transaction('media').objectStore('media').get(name))
}

export async function mediaPut(name, blob) {
  const db = await open()
  const tx = db.transaction('media', 'readwrite')
  tx.objectStore('media').put(blob, name)
  return done(tx)
}

export async function clearAll() {
  const db = await open()
  const names = [...STORES, 'meta', 'media']
  const tx = db.transaction(names, 'readwrite')
  for (const n of names) tx.objectStore(n).clear()
  return done(tx)
}
