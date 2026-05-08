import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative base avoids blank screens when the app is loaded inside native WebView.
  base: './',

  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,
      },
      includeAssets: ['pwa/icon-192.png', 'pwa/icon-512.png', 'offline.html'],
      workbox: {
        navigateFallback: '/offline.html',
      },
      manifest: {
        name: 'BookMeter',
        short_name: 'BookMeter',
        description: 'App para encontrar, compartir y chatear sobre libros cercanos.',
        theme_color: '#0F766E',
        background_color: '#F4F7FB',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    host: true,
    allowedHosts: [".trycloudflare.com"],
  },

  build: {
    // API 29 emulators may run older WebView versions; transpile to safer output.
    target: 'es2019',
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
