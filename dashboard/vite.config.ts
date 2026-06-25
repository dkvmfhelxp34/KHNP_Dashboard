import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 외부 터널(Cloudflare trycloudflare 등)에서 들어오는 Host 허용 — preview 403 방지.
  preview: { allowedHosts: true },
  server: { allowedHosts: true },
})
