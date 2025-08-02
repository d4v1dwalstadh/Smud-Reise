import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/smud-reise/', // Dette må matche repository-navnet ditt
  build: {
    outDir: 'dist',
  },
})