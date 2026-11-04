import { useEffect, useState } from 'react'
import { getState } from './store'

export function haptic(pattern = 8) {
  if (getState().settings.haptics && navigator.vibrate) navigator.vibrate(pattern)
}

// Хэш-роутер: #/s/<id>, #/d/<id>, #/study/all … — кнопка «назад» на телефоне работает сама
export function useRoute() {
  const [hash, setHash] = useState(() => location.hash.slice(1) || '/')
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || '/')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const parts = hash.split('/').filter(Boolean)
  return { path: hash, parts }
}

export const go = (path) => {
  location.hash = path
}
export const back = (fallback = '/') => {
  if (history.length > 1) history.back()
  else go(fallback)
}

// Тема: system/light/dark → data-theme на <html> и цвет строки состояния
export function applyTheme(pref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17191f' : '#f4f5f8')
}

export function useMediaQuery(q) {
  const [m, setM] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}
