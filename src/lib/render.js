import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import swift from 'highlight.js/lib/languages/swift'
import objectivec from 'highlight.js/lib/languages/objectivec'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'

hljs.registerLanguage('swift', swift)
hljs.registerLanguage('objectivec', objectivec)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('xml', xml)

const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }) {
      // Вопросы у нас про iOS — код без указания языка считаем Swift
      const language = hljs.getLanguage(lang || '') ? lang : 'swift'
      const html = hljs.highlight(text, { language }).value
      return `<pre class="code"><code class="hljs">${html}</code></pre>`
    },
  },
})

// Картинки из .apkg хранятся локально: src подменяем на data-media, компонент подгружает blob
function mediaHook(node) {
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') || ''
    if (src && !/^(https?:|data:|blob:)/.test(src)) {
      node.setAttribute('data-media', decodeURIComponent(src))
      node.removeAttribute('src')
    }
  }
}

export function renderContent(text, format) {
  if (!text) return ''
  const raw = format === 'html' ? text.replace(/\[sound:[^\]]+\]/g, '') : md.parse(text)
  DOMPurify.addHook('afterSanitizeAttributes', mediaHook)
  const out = DOMPurify.sanitize(raw, { ADD_ATTR: ['data-media'] })
  DOMPurify.removeHook('afterSanitizeAttributes')
  return out
}

// Короткий текст без разметки — для списков
export function plain(text, max = 140) {
  const s = (text || '')
    .replace(/```[\s\S]*?```/g, ' ‹код› ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
