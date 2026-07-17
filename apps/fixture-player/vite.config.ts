import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { player: resolve(import.meta.dirname, 'index.html'), hydration: resolve(import.meta.dirname, 'hydration.html') } } },
})
