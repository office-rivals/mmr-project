import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    // Under the Aspire-managed dev server, Vite re-optimizing dependencies
    // mid-request crashes esbuild with "write EPIPE" on the first page load;
    // forcing a clean pre-bundle at startup avoids it. Scope it to the AppHost
    // run (marker env set there) so a standalone `npm run dev` keeps its dep
    // cache and fast restarts.
    force: !!process.env.ASPIRE_MANAGED,
  },
});
