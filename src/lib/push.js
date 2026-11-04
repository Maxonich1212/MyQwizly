import { sb } from './supabase'
import { getState } from './store'

// Push-напоминания. Ключ VAPID публичный — приватная часть лежит только на сервере (app_secrets)
const VAPID_PUBLIC = 'BPdrJJ_JYSt-uiHTq9vgDy42osX_raFRPGeOBAp_lDJpOX3nZBfBIarlD-Iz5ychAawY-JSejKdTIjc1BmwSTkI'
export const DEFAULT_TIMES = ['21:00', '22:50']
const LS = 'mq-push'

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
// На iPhone уведомления доступны только приложению, открытому с экрана «Домой»
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export function loadPushPrefs() {
  try {
    return { enabled: false, times: DEFAULT_TIMES, ...JSON.parse(localStorage.getItem(LS) || '{}') }
  } catch {
    return { enabled: false, times: DEFAULT_TIMES }
  }
}

function savePushPrefs(p) {
  localStorage.setItem(LS, JSON.stringify(p))
}

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function saveSubscription(sub, times, enabled) {
  const j = sub.toJSON()
  const { error } = await sb.from('push_subs').upsert({
    id: await sha256(j.endpoint),
    user_id: getState().user.id,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    times: [...times].sort(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow',
    enabled,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

// Включить: разрешение → подписка браузера → запись в Supabase
export async function enablePush(times = DEFAULT_TIMES) {
  if (!pushSupported()) throw new Error('unsupported')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('denied')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }))
  await saveSubscription(sub, times, true)
  savePushPrefs({ enabled: true, times })
}

export async function updatePushTimes(times) {
  const prefs = loadPushPrefs()
  savePushPrefs({ ...prefs, times })
  if (!prefs.enabled || !pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) await saveSubscription(sub, times, true)
}

export async function disablePush() {
  const prefs = loadPushPrefs()
  savePushPrefs({ ...prefs, enabled: false })
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await sb.from('push_subs').delete().eq('id', await sha256(sub.endpoint))
  await sub.unsubscribe().catch(() => {})
}

export async function sendTestPush() {
  const { data, error } = await sb.functions.invoke('remind', { body: { test: true } })
  if (error) throw error
  return data
}
