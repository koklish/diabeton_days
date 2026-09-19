import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base '' keeps asset URLs relative so the same build works from GitHub Pages
// (served from /<repo>/) and from the Capacitor WebView (capacitor://localhost).
export default defineConfig({
  plugins: [react()],
  base: '',
  build: { outDir: 'dist', sourcemap: false },
})
