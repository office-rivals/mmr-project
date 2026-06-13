import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // Force a clean dependency pre-bundle on startup so esbuild doesn't re-optimize
  // mid-request and crash with "write EPIPE" on the first page load under the
  // Aspire-managed dev server.
  optimizeDeps: {
    force: true,
  },
});
