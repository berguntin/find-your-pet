import {fileURLToPath} from 'url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vercel from 'vite-plugin-vercel'
console.log('META:',fileURLToPath(new URL('./src', import.meta.url)))
// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vercel()],
  resolve: {
    alias:[ 
      { find : '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }
    ]
  }
})
