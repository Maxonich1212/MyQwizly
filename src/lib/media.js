import { sb } from './supabase'
import { mediaGet, mediaPut, metaGet, metaSet } from './idb'
import { getState } from './store'

// Картинки карточек: локально в IndexedDB, копия в приватном бакете Supabase для других устройств
const urls = new Map()

const path = (name) => `${getState().user.id}/${encodeURIComponent(name)}`

export async function saveMedia(files) {
  // files: [{ name, blob }]
  const pending = new Set((await metaGet('mediaPending')) || [])
  for (const f of files) {
    await mediaPut(f.name, f.blob)
    pending.add(f.name)
  }
  await metaSet('mediaPending', [...pending])
  uploadPending()
}

let uploading = false
export async function uploadPending() {
  if (uploading || !navigator.onLine || !getState().user) return
  uploading = true
  try {
    const pending = new Set((await metaGet('mediaPending')) || [])
    for (const name of [...pending]) {
      const blob = await mediaGet(name)
      if (blob) {
        const { error } = await sb.storage.from('media').upload(path(name), blob, { upsert: true, contentType: blob.type || undefined })
        if (error && !/exists/i.test(error.message)) continue
      }
      pending.delete(name)
      await metaSet('mediaPending', [...pending])
    }
  } finally {
    uploading = false
  }
}

export async function mediaUrl(name) {
  if (urls.has(name)) return urls.get(name)
  let blob = await mediaGet(name)
  if (!blob && getState().user) {
    const { data } = await sb.storage.from('media').download(path(name))
    if (data) {
      blob = data
      await mediaPut(name, data)
    }
  }
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urls.set(name, url)
  return url
}

export async function hydrateMedia(root) {
  if (!root) return
  for (const img of root.querySelectorAll('img[data-media]')) {
    const url = await mediaUrl(img.dataset.media)
    if (url) img.src = url
  }
}
