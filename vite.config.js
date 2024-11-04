import {fileURLToPath} from 'url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vercel from 'vite-plugin-vercel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias:[ 
      { find : '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }
    ]
  },
  server: {
    port: process.env.PORT
  },
  build: {
    outDir: 'dist'
  }
})
