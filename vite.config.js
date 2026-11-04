import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

// Версия сборки: дата и время (МСК) — видна в настройках и вшивается в sw.js
const now = new Date(Date.now() + 3 * 3600e3)
const VERSION = now.toISOString().slice(0, 16).replace('T', '.').replace(/-/g, '.').replace(':', '')

const stampServiceWorker = {
  name: 'stamp-sw',
  closeBundle() {
    const f = 'dist/sw.js'
    if (existsSync(f)) writeFileSync(f, readFileSync(f, 'utf8').replaceAll('__BUILD__', VERSION))
  },
}

// Относительный base: одинаково работает на GitHub Pages (/MyQwizly/) и локально
export default defineConfig({
  base: './',
  plugins: [react(), stampServiceWorker],
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  server: { port: 5180 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/sql.js') || id.includes('node_modules/jszip') || id.includes('node_modules/fzstd')) return 'import'
          if (id.includes('node_modules/highlight.js') || id.includes('node_modules/marked') || id.includes('node_modules/dompurify')) return 'render'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) return 'motion'
        },
      },
    },
  },
})
