import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // This is correct
  base: "/",

  // 🔥 VERY IMPORTANT for LAN access
  server: {
    host: "0.0.0.0", // allows other devices on your network
    port: 5173
  }
})