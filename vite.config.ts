import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Automatically activate the new SW and reload when a new build is deployed.
      registerType: 'autoUpdate',

      // Static assets to precache as part of the app shell.
      includeAssets: ['favicon.svg', 'icons/*.svg', 'icons/*.png'],

      workbox: {
        // Precache all hashed JS/CSS bundles plus static assets.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],

        // Serve the cached app shell for any HTML navigation request that
        // doesn't match a precached file — enables offline SPA routing.
        navigateFallback: '/index.html',

        // Never serve the offline fallback for these URL patterns (they are
        // not part of the SPA and must not get a stale HTML response).
        navigateFallbackDenylist: [/^\/api/, /^\/rest/],

        runtimeCaching: [
          {
            // All Supabase traffic (auth, REST, Realtime) is network-only.
            // Must not be cached — auth tokens and project data are user-specific
            // and must never be stored in shared Cache Storage.
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\//i,
            handler: 'NetworkOnly',
          },
        ],
      },

      manifest: {
        name: 'ProjectFlow',
        short_name: 'ProjectFlow',
        description: 'Lightweight collaborative project management',
        // theme_color appears in the browser toolbar and the OS task switcher.
        theme_color: '#f97316',
        // background_color is shown on the splash screen while the app loads.
        background_color: '#0f0e0d',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/projectflow-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/projectflow-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/projectflow-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/projectflow-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
