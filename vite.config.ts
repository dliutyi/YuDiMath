import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // Use base path for GitHub Pages, but not for local development
  // Check for GITHUB_PAGES env var (set in GitHub Actions) or use empty for local
  base: process.env.GITHUB_PAGES === 'true' ? '/YuDiMath/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 3000,
  },
})

