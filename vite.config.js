import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND_URL = 'http://127.0.0.1:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    // Izinkan akses lewat domain tunnel ngrok (mis. dari HP).
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev', '.ngrok.io'],
    // Dipakai saat VITE_API_BASE_URL kosong (mode ngrok, lihat .env.ngrok):
    // request /api & /uploads diteruskan ke backend CI, jadi browser cukup
    // bicara ke satu origin (cookie sesi aman, tanpa CORS).
    proxy: {
      '/api': { target: BACKEND_URL, changeOrigin: true },
      '/uploads': { target: BACKEND_URL, changeOrigin: true },
    },
  },
})
