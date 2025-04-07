import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import viteConsoleLogger from 'vite-plugin-console-logger';
// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), viteConsoleLogger({ onlyServer: true })],
  server: {
    port: 8080,
  },
});
