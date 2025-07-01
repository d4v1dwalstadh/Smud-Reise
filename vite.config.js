import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Du kan endre porten her hvis ønskelig
  },
  build: {
    outDir: 'dist', // Output mappe når du bygger prosjektet
  },
})
