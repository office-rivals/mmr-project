<script lang="ts">
  import { signIn } from '@auth/sveltekit/client';
  import { onMount } from 'svelte';

  onMount(() => {
    signIn('auth0');
  });
</script>
