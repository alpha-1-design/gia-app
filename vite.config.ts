import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    pool: 'threads',
  },
  plugins: [
    react(),
    !process.env.VITEST && tailwindcss(),
  ].filter(Boolean),
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api/sandbox': {
        target: 'http://localhost:3081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sandbox/, ''),
      },
    },
  },
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
    chunkSizeWarningLimit: 1000,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/motion')) return 'vendor-motion';
          if (id.includes('node_modules/lucide-react')) return 'vendor-ui';
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (id.includes('node_modules/leaflet')) return 'vendor-maps';
          if (id.includes('node_modules/mermaid')) return 'vendor-mermaid';
          if (id.includes('node_modules/three')) return 'vendor-three';
          if (id.includes('node_modules/pdfjs-dist')) return 'vendor-pdf';
          if (id.includes('node_modules/pdf-lib')) return 'vendor-pdf-lib';
          if (id.includes('node_modules/katex')) return 'vendor-katex';
          if (id.includes('node_modules/zod')) return 'vendor-zod';
          if (id.includes('node_modules/zustand')) return 'vendor-state';
          if (id.includes('node_modules/qrcode')) return 'vendor-qrcode';
        },
      },
    },
  },
})
