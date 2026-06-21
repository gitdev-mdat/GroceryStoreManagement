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
        name: 'Hải Kiều - Quản lý Sổ sách',
        short_name: 'Hải Kiều',
        description: 'Phần mềm Quản lý Doanh thu & Sổ sách Hộ Kinh Doanh',
        theme_color: '#1E3A5F',
        background_color: '#1E3A5F',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
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
