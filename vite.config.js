import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Относительный base: одинаково работает на GitHub Pages (/MyQwizly/) и локально
export default defineConfig({
  base: './',
  plugins: [react()],
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
