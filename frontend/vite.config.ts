import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    force: true,
    holdUntilCrawlEnd: false,
    include: [
      '@clerk/shared/authorization',
      '@clerk/shared/deriveState',
      '@clerk/shared/loadClerkJsScript',
      '@clerk/shared/underscore',
    ],
  },
  server: {
    warmup: {
      ssrFiles: [
        './src/hooks.server.ts',
        './src/routes/(authed)/+page.server.ts',
        './src/routes/(authed)/+layout.server.ts',
      ],
    },
  },
});
