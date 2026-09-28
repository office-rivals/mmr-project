import { defineConfig, loadEnv } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command, mode }) => {
  // Mirror local server config in dev; production reads its environment at runtime.
  if (command === 'serve') {
    const fileEnv = loadEnv(mode, process.cwd(), '');
    for (const [key, value] of Object.entries(fileEnv)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }

  return {
    server: {
      port: 5173,
      strictPort: true, // fail loudly instead of drifting to 5174 — Playwright depends on this
    },
    resolve: { tsconfigPaths: true },
    // Plugin order matters: tanstackStart() before viteReact().
    plugins: [
      tailwindcss(),
      tanstackStart({
        // Preserve the shared suite's observable loader-refetch URL marker.
        serverFns: { base: '/_serverFn/__data.json' },
      }),
      viteReact(),
    ],
  };
});
