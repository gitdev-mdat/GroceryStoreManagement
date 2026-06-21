import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'maskable-icon.png'],
      manifest: {
        name: 'Haikieu Web App',
        short_name: 'Haikieu',
        description: 'Ứng dụng quản lý Haikieu',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'icon-192.png',
            type: 'image/png',
            sizes: '192x192'
          },
          {
            src: 'icon-512.png',
            type: 'image/png',
            sizes: '512x512'
          }
        ]
      }
    })
  ]
})
