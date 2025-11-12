import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const resolvePath = (relativePath: string) => new URL(relativePath, import.meta.url);
const manifest = JSON.parse(
  readFileSync(resolvePath('./public/manifest.json'), 'utf-8')
);

export default defineConfig({
  plugins: [
    VitePWA({
      // Node 23 + @rollup/plugin-terser currently causes generateSW to exit early
      // whenever mode === 'production'. Default to 'development' to skip terser.
      mode: process.env.PWA_SW_MODE ?? 'development',
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/**/*',
        'sound/**/*',
        'atlases/**/*',
        'logo/**/*',
        'og/**/*',
        'cloud-transform/**/*'
      ],
      manifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json,mp3,ogg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[^/]+\/api\/(scores|leaderboard|users)/,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'api-network-only'
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(resolvePath('./src'))
    }
  }
});
