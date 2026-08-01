import { defineConfig, loadEnv } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // Vite only surfaces VITE_-prefixed vars on import.meta.env and never touches
  // process.env. Server-only config (API_BASE_PATH, CLERK_SECRET_KEY) is read
  // through process.env so it stays runtime-resolved in the container, so the
  // dev server has to mirror .env into process.env itself. Only in `serve` —
  // during `build` this would risk baking local values into the output.
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
      tanstackStart({
        // Loader/RPC traffic is namespaced under `__data.json` because that is
        // the path the Playwright suite treats as "the app refetched its data"
        // (e2e/pull-to-refresh.spec.ts waits for such a request to prove the
        // pull committed a refresh). The suite is a frozen contract, so the
        // transport is named to fit it; only the URL prefix changes.
        serverFns: { base: '/_serverFn/__data.json' },
      }),
      viteReact(),
    ],
  };
});
