import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/agentic-chat/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        current: resolve(import.meta.dirname, 'index.html'),
        stable: resolve(import.meta.dirname, '1.0/index.html'),
      },
    },
  },
})
