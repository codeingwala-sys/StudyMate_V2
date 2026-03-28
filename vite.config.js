import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest lets us use our custom SW with workbox imports
      strategies:   'injectManifest',
      srcDir:       'src',
      filename:     'sw-custom.js',
      registerType: 'prompt',
      devOptions:   { enabled: true, type: 'module' },

      includeAssets: ['icons/*.png', 'icons/*.svg'],

      workbox: {
        // Files to precache
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },

      manifest: {
        name:             'StudyMate',
        short_name:       'StudyMate',
        description:      'Advanced AI study companion — notes, timer, practice tests',
        theme_color:      '#000000',
        background_color: '#000000',
        display:          'standalone',
        orientation:      'portrait',
        scope:            '/',
        start_url:        '/',
        categories:       ['education', 'productivity'],
        icons: [
          { src: '/icons/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/maskable-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
        screenshots: [
          { src: '/icons/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml', form_factor: 'narrow' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react'],
          'vendor-utils': ['zustand', 'idb', '@supabase/supabase-js'],
          'vendor-viz': ['recharts', 'reactflow', '@tldraw/tldraw'],
        }
      }
    },
    chunkSizeWarningLimit: 800
  }
})