import { useSyncExternalStore } from 'react'
import { sb } from './supabase'
import * as idb from './idb'
import { dayKey } from './day'

// Локальное хранилище — источник правды для UI, Supabase — для синхронизации между устройствами.
// Каждая правка: state → IndexedDB → id в dirty → отложенный push. Pull тянет строки по server_at.

const TABLES = idb.STORES

export const DEFAULT_SETTINGS = {
  theme: 'system',
  dailyGoal: 20,
  goalHistory: [],
  newPerDay: 15,
  freezesPerWeek: 2,
  sectionGoal: 10,
  retention: 0.9,
  autoSpeak: true,
  haptics: true,
}

let state = {
  ready: false,
  user: null,
  sections: {},
  decks: {},
  notes: {},
  reviews: {},
  settings: DEFAULT_SETTINGS,
  sync: { status: 'idle', at: null, error: null },
}
const listeners = new Set()
let dirty = { sections: new Set(), decks: new Set(), notes: new Set(), reviews: new Set(), settings: false }
let pullCursor = {}
let settingsUpdatedAt = 0
let syncTimer = null
let syncing = null

function emit(patch) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export function getState() {
  return state
}

export function useStore(selector) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
  )
}

export const uid = () => crypto.randomUUID()

function persistDirty() {
  const plain = Object.fromEntries(TABLES.map((t) => [t, [...dirty[t]]]))
  plain.settings = dirty.settings
  return idb.metaSet('dirty', plain)
}

// ——— Мутации ———

export function upsertRows(table, rows) {
  if (!rows.length) return
  const now = Date.now()
  const map = { ...state[table] }
  const saved = []
  for (const r of rows) {
    const row = { ...r, updated_at: now }
    map[row.id] = row
    dirty[table].add(row.id)
    saved.push(row)
  }
  emit({ [table]: map })
  if (state.user?.id === 'demo') return saved
  idb.putMany(table, saved)
  persistDirty()
  scheduleSync()
  return saved
}

export const upsert = (table, row) => upsertRows(table, [row])[0]

export function patch(table, id, changes) {
  const cur = state[table][id]
  if (!cur) return
  return upsert(table, { ...cur, ...changes })
}

export function remove(table, id) {
  return patch(table, id, { deleted: true })
}

export function updateSettings(changes) {
  const next = { ...state.settings, ...changes }
  if ('dailyGoal' in changes && changes.dailyGoal !== state.settings.dailyGoal) {
    // История целей нужна, чтобы смена цели не переписывала прошлые стрики
    const today = dayKey()
    const hist = (next.goalHistory || []).filter((g) => g.from !== today)
    if (!hist.length) hist.push({ from: '2000-01-01', goal: state.settings.dailyGoal })
    hist.push({ from: today, goal: changes.dailyGoal })
    next.goalHistory = hist
  }
  settingsUpdatedAt = Date.now()
  dirty.settings = true
  emit({ settings: next })
  idb.metaSet('settings', { data: next, updated_at: settingsUpdatedAt })
  persistDirty()
  scheduleSync()
}

// ——— Загрузка и вход ———

export async function boot() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    const { demoData } = await import('./demo')
    emit({ ...demoData(), user: { id: 'demo', email: 'demo@local' }, ready: true })
    return
  }
  const { data } = await sb.auth.getSession()
  await onUser(data.session?.user ?? null)
  sb.auth.onAuthStateChange((_e, session) => {
    const u = session?.user ?? null
    if ((u?.id ?? null) !== (state.user?.id ?? null)) onUser(u)
  })
  window.addEventListener('online', () => scheduleSync(0))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(0)
  })
  setInterval(() => scheduleSync(0), 90_000)
}

async function onUser(user) {
  if (!user) {
    emit({ user: null, ready: true })
    return
  }
  const owner = await idb.metaGet('owner')
  if (owner && owner !== user.id) await idb.clearAll()
  await idb.metaSet('owner', user.id)
  await loadLocal()
  emit({ user, ready: true })
  scheduleSync(0)
}

async function loadLocal() {
  const patchState = {}
  for (const t of TABLES) {
    const rows = await idb.getAll(t)
    patchState[t] = Object.fromEntries(rows.map((r) => [r.id, r]))
  }
  const d = (await idb.metaGet('dirty')) || {}
  for (const t of TABLES) dirty[t] = new Set(d[t] || [])
  dirty.settings = !!d.settings
  pullCursor = (await idb.metaGet('cursor')) || {}
  const s = await idb.metaGet('settings')
  settingsUpdatedAt = s?.updated_at || 0
  patchState.settings = { ...DEFAULT_SETTINGS, ...(s?.data || {}) }
  emit(patchState)
}

export async function signOut() {
  await syncNow().catch(() => {})
  await sb.auth.signOut()
  await idb.clearAll()
  dirty = { sections: new Set(), decks: new Set(), notes: new Set(), reviews: new Set(), settings: false }
  pullCursor = {}
  emit({ sections: {}, decks: {}, notes: {}, reviews: {}, settings: DEFAULT_SETTINGS, user: null })
}

// ——— Синхронизация ———

export function scheduleSync(delay = 1500) {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => syncNow().catch(() => {}), delay)
}

export function syncNow() {
  if (!state.user || state.user.id === 'demo' || !navigator.onLine) return Promise.resolve()
  if (syncing) return syncing
  emit({ sync: { ...state.sync, status: 'syncing' } })
  syncing = (async () => {
    try {
      await push()
      await pull()
      emit({ sync: { status: 'ok', at: Date.now(), error: null } })
    } catch (e) {
      console.warn('sync', e)
      emit({ sync: { ...state.sync, status: 'error', error: String(e.message || e) } })
      throw e
    } finally {
      syncing = null
    }
  })()
  return syncing
}

const stripRow = ({ server_at: _s, ...r }) => r

async function push() {
  const user_id = state.user.id
  for (const t of TABLES) {
    const ids = [...dirty[t]]
    if (!ids.length) continue
    const rows = ids.map((id) => state[t][id]).filter(Boolean).map((r) => ({ ...stripRow(r), user_id }))
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400)
      const { error } = await sb.from(t).upsert(chunk)
      if (error) throw error
      for (const r of chunk) {
        // Строку могли поправить, пока шёл запрос — тогда она остаётся грязной
        if (state[t][r.id]?.updated_at === r.updated_at) dirty[t].delete(r.id)
      }
    }
    await persistDirty()
  }
  if (dirty.settings) {
    const sent = settingsUpdatedAt
    const { error } = await sb.from('settings').upsert({ user_id, data: state.settings, updated_at: sent })
    if (error) throw error
    if (settingsUpdatedAt === sent) dirty.settings = false
    await persistDirty()
  }
}

async function pull() {
  for (const t of TABLES) {
    let since = pullCursor[t] || '1970-01-01T00:00:00Z'
    for (;;) {
      const { data, error } = await sb.from(t).select('*').gt('server_at', since).order('server_at').limit(1000)
      if (error) throw error
      if (!data.length) break
      merge(t, data)
      since = data[data.length - 1].server_at
      pullCursor[t] = since
      await idb.metaSet('cursor', pullCursor)
      if (data.length < 1000) break
    }
  }
  const { data, error } = await sb.from('settings').select('*').maybeSingle()
  if (error) throw error
  if (data && data.updated_at > settingsUpdatedAt && !dirty.settings) {
    settingsUpdatedAt = data.updated_at
    const next = { ...DEFAULT_SETTINGS, ...data.data }
    emit({ settings: next })
    await idb.metaSet('settings', { data: next, updated_at: data.updated_at })
  }
}

function merge(table, rows) {
  const map = { ...state[table] }
  const changed = []
  for (const r of rows) {
    const local = map[r.id]
    if (local && dirty[table].has(r.id) && local.updated_at > r.updated_at) continue
    map[r.id] = r
    dirty[table].delete(r.id)
    changed.push(r)
  }
  if (!changed.length) return
  emit({ [table]: map })
  idb.putMany(table, changed)
}
