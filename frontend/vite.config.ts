import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'svelte',
      'svelte/animate',
      'svelte/attachments',
      'svelte/easing',
      'svelte/internal',
      'svelte/internal/client',
      'svelte/internal/disclose-version',
      'svelte/internal/flags/async',
      'svelte/internal/flags/legacy',
      'svelte/internal/flags/tracing',
      'svelte/legacy',
      'svelte/motion',
      'svelte/reactivity',
      'svelte/reactivity/window',
      'svelte/store',
      'svelte/transition',
      'svelte/events',
      '@carbon/charts-svelte',
      'bits-ui',
      'clsx',
      'devalue',
      'esm-env',
      'formsnap',
      'lucide-svelte',
      'lucide-svelte/icons/x',
      'svelte-clerk',
      'sveltekit-superforms',
      'sveltekit-superforms/adapters',
      'tailwind-merge',
      'tailwind-variants',
      'zod',
    ],
  },
  esbuild: {
    // Limit concurrent transforms to prevent esbuild service crash under Docker
    logLevel: 'error',
  },
});
