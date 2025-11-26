import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";

// Allow base path override via env (Vite loads .env files)
const base = process.env.VITE_BASE || '/';

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
  },
})
