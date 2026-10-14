import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors the SvelteKit aliases ($lib is implicit there, the rest come from
// svelte.config.js) so tests can import modules the app imports by alias.
const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      $lib: `${src}/lib`,
      $api: `${src}/api`,
      $api3: `${src}/api-v3`,
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
