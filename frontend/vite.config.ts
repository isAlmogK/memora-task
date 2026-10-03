import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In http mode the app calls /v1/*; the dev server forwards it to the Nest API.
    proxy: { '/v1': 'http://localhost:3000' },
  },
})
