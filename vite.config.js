import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Served from https://<owner>.github.io/Nick/ on GitHub Pages.
  base: '/Nick/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})
