import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  const apiProxyTarget = process.env.VITE_API_PROXY_TARGET;

  return {
    plugins: [react()],
    server: apiProxyTarget ? {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    } : undefined,
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks: {
            videojs: ['video.js'],
          },
        },
      },
    },
  };
});
