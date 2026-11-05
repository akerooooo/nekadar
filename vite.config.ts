import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages'te https://<kullanici>.github.io/nekadar/ altinda yayinlanir
const base = process.env.BASE_PATH ?? '/nekadar/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.png'],
      manifest: {
        name: 'Nekadar – Harcama Takibi',
        short_name: 'Nekadar',
        description: 'Nelere ne kadar harcadığını gör. Ücretsiz, verilerin telefonunda kalır.',
        lang: 'tr',
        theme_color: '#fafaf8',
        background_color: '#fafaf8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Fis okuma icin indirilen OCR dosyalarini da sakla (bir kez indirilince internetsiz calisir)
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname.includes('jsdelivr.net') || url.hostname.includes('tessdata'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-assets',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
