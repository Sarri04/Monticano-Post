import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base = nome del repository per GitHub Pages (https://sarri04.github.io/Monticano-Post/)
export default defineConfig({
  base: process.env.BASE_PATH ?? '/Monticano-Post/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,woff2,woff,svg,png}'], navigateFallback: 'index.html' },
      manifest: {
        name: 'Programmi Monticano', short_name: 'Monticano', lang: 'it',
        description: 'Grafiche Instagram del Monticano C5',
        theme_color: '#0b1f3a', background_color: '#0b1f3a', display: 'standalone',
        orientation: 'portrait', start_url: '.', scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' }
});
