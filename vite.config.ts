import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // CRITICAL for Capacitor Android APK — assets must use relative paths
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Ensure assets are bundled cleanly for WebView
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          motion: ['framer-motion'],
          store: ['zustand'],
          recharts: ['recharts'],
          ui: ['lucide-react'],
          qrcode: ['qrcode'],
        },
      },
    },
  },
})
