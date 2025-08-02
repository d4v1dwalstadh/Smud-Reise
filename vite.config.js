import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // GitHub Pages base path - VIKTIG: Må matche repository navnet nøyaktig
  base: '/Smud-Reise/', // Endret til å matche package.json homepage
  
  server: {
    port: 5173,
  },
  
  build: {
    outDir: 'dist',
    // Legg til disse for bedre GitHub Pages kompatibilitet
    assetsDir: 'assets',
    sourcemap: false, // Reduserer build størrelse
  },
  
  // Legg til for bedre GitHub Pages support
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
})