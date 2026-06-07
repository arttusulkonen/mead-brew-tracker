import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Mead & Brew Tracker',
        short_name: 'MeadTracker',
        description: 'Professional mead and brew management',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '32x32',
            type: 'image/x-icon'
          }
        ]
      }
    })
  ]
});