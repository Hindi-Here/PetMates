import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'

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
      additionalData: `@use "@/function.scss" as *;`
    }
  }
}

})
