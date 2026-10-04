import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // A single .env at the repo root configures both server and client.
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '');
  const serverPort = env.PORT || '3001';

  return {
    envDir: '..',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // Same-origin in dev: the browser talks to Vite, Vite forwards signaling to Express.
      proxy: {
        '/socket.io': { target: `http://localhost:${serverPort}`, ws: true },
        '/api': { target: `http://localhost:${serverPort}` },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
