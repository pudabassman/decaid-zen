import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

export default defineConfig(({ mode }) => {
  const vars = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react()],
    base: './',
    define: {
      __GATEWAY__: JSON.stringify(vars.VITE_GATEWAY ?? ''),
      __SKIN_VERSION__: JSON.stringify(pkg.version),
    },
    build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
    server: { port: 5173 },
  }
})
