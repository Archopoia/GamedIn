import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const WIDGET_VERSION = '3'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'widget-cache-bust',
      transformIndexHtml(html) {
        return html.replace(/src="\.\/(widget\.js)"/, `src="./$1?v=${WIDGET_VERSION}"`)
      },
    },
  ],
  base: './',
  build: {
    outDir: resolve(__dirname, '../extension/widget'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'widget.html'),
      output: {
        entryFileNames: 'widget.js',
        chunkFileNames: 'widget-[name]-[hash].js',
        assetFileNames: 'widget-[name][extname]',
      },
    },
    minify: true,
    sourcemap: false,
  },
})
