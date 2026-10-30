import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // En Docker el .env vive en la raíz del repo. En Vercel el proyecto
  // es solo frontend/ y la URL de la API llega como variable de entorno.
  envDir: process.env.VERCEL ? "." : "../",
  server: {
    // host 0.0.0.0 es necesario para que el servidor de Vite sea
    // accesible desde fuera del contenedor Docker.
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
