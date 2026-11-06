import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Deliberately NOT reusing vite.config.ts: the TanStack Start plugin rewrites
// the module graph for SSR/router codegen, which the pure-function unit suite
// does not need and which makes runs slower and more fragile.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'e2e/**/*.test.mjs'],
    // The date helpers format through `toLocaleDateString(undefined, …)`, so
    // the expected strings ("Friday, Jun 12") depend on the ambient locale and
    // timezone. Pin both so the suite is machine-independent.
    env: { TZ: 'UTC', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
  },
});
