<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ClerkProvider } from 'svelte-clerk';
  import '../app.pcss';

  const { children }: { children: Snippet } = $props();
</script>

<ClerkProvider>
  {@render children()}
</ClerkProvider>
