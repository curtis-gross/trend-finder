import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// API server port: .run/server.port (written by server_control.sh) > env PORT > 8080.
const readApiPort = (envPort?: string): string => {
    try {
        const p = fs.readFileSync(path.resolve(__dirname, '.run/server.port'), 'utf8').trim();
        if (p) return p;
    } catch { /* file absent: use env or default */ }
    return envPort || '8080';
};

// Vite frontend port: env VITE_PORT > .run/vite.port > 3000.
const readVitePort = (envVitePort?: string): number => {
    if (envVitePort) {
        const parsed = parseInt(envVitePort, 10);
        if (!Number.isNaN(parsed)) return parsed;
    }
    try {
        const p = fs.readFileSync(path.resolve(__dirname, '.run/vite.port'), 'utf8').trim();
        const parsed = parseInt(p, 10);
        if (!Number.isNaN(parsed)) return parsed;
    } catch { /* file absent: use default */ }
    return 3000;
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiPort = readApiPort(process.env.BACKEND_PORT || process.env.VITE_API_PORT || process.env.PORT || env.PORT);
    const frontendPort = readVitePort(process.env.VITE_PORT || env.VITE_PORT);
    const apiTarget = `http://127.0.0.1:${apiPort}`;

    return {
      server: {
        port: frontendPort,
        strictPort: false,
        host: '0.0.0.0',
        watch: {
          ignored: [
            '**/.venv/**',
            '**/.run/**',
            '**/dist/**',
            '**/__pycache__/**',
            '**/.pytest_cache/**',
            '**/runs/**'
          ]
        },
        proxy: {
            '/api': { target: apiTarget, changeOrigin: true },
            '/health': { target: apiTarget, changeOrigin: true },
            '/healthz': { target: apiTarget, changeOrigin: true },
            '/data': { target: apiTarget, changeOrigin: true }
        }
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 3500,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return undefined;
              if (
                id.includes('/node_modules/react/') ||
                id.includes('/node_modules/react-dom/') ||
                id.includes('/node_modules/scheduler/')
              ) {
                return 'vendor-react';
              }
              if (id.includes('/node_modules/lucide-react/')) {
                return 'vendor-icons';
              }
              if (
                id.includes('/node_modules/recharts/') ||
                id.includes('/node_modules/recharts-scale/') ||
                id.includes('/node_modules/victory-vendor/')
              ) {
                return 'vendor-recharts';
              }
              if (
                id.includes('/node_modules/d3-') ||
                id.includes('/node_modules/d3/') ||
                id.includes('/node_modules/internmap/')
              ) {
                return 'vendor-d3';
              }
              return undefined;
            }
          }
        }
      }
    };
});
