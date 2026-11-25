import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // IWER エミュレータ関連は本番では遅延ロード（未使用）のため分離維持
          if (id.includes('iwer') || id.includes('emulate')) return undefined
          if (id.includes('node_modules/three/') || id.includes('node_modules\\three\\')) {
            return 'vendor-three'
          }
          if (
            id.includes('@react-three') ||
            id.includes('@pmndrs') ||
            id.includes('troika')
          ) {
            return 'vendor-r3f'
          }
          return undefined
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
  },
})
