import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // base relativo: funciona tanto en la raiz de un subdominio como en un subdirectorio.
  base: './',
  plugins: [react()],
})
