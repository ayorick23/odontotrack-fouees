import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Lee el archivo .env desde la raíz del monorepo (no desde
  // frontend/) para que backend y frontend compartan un solo archivo
  // de variables de entorno, tal como lo espera docker-compose.
  envDir: '../',
  server: {
    // host 0.0.0.0 es necesario para que el servidor de Vite sea
    // accesible desde fuera del contenedor Docker.
    host: '0.0.0.0',
    port: 5173,
  },
})
