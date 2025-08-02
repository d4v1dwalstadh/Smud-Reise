import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // GitHub Pages base path - endre 'smud-reise' til ditt repository-navn
  base: '/smud-reise/',
  
  server: {
    port: 5173, // Du kan endre porten her hvis ønskelig
  },
  
  build: {
    outDir: 'dist', // Output mappe når du bygger prosjektet
  },
})