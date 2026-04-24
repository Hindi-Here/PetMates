import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'

import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({

  plugins: [
    react(), 
    svgr(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), 
      '@icons': path.resolve(__dirname, '../../assets/icons'),
    },
  },

  css: {
  preprocessorOptions: {
    scss: {
      additionalData: `@use "@/components/scripts/function.scss" as *;`
    }
  }
}

})
