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
    // Use esbuild for CSS minification to avoid LightningCSS conflicts with TailwindCSS v4
    cssMinify: 'esbuild',
    // Ensure assets are bundled cleanly for WebView
    assetsDir: 'assets',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/motion')) return 'vendor-motion';
          if (id.includes('node_modules/lucide-react')) return 'vendor-ui';
          if (id.includes('node_modules/recharts')) return 'vendor-recharts';
          if (id.includes('node_modules/zustand') || id.includes('node_modules/jszip') || id.includes('node_modules/qrcode')) return 'vendor-utils';
        },
      },
    },
  },
})
