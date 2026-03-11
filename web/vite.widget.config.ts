import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
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
