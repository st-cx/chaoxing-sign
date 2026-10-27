import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import UnoCSS from '@unocss/vite'

const fromProject = createRequire(import.meta.url)
const fromNuxt = createRequire(fromProject.resolve('nuxt/package.json'))
const vue = fromNuxt('@vitejs/plugin-vue')

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  base: './',
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  plugins: [vue(), UnoCSS({ configFile: fileURLToPath(new URL('../unocss.config.ts', import.meta.url)) })],
  resolve: { dedupe: ['vue', 'naive-ui', 'pinia'], alias: { '~': fileURLToPath(new URL('../', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { target: 'esnext', outDir: '../.preview', emptyOutDir: true },
})
