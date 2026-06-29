<script lang="ts">
  import '@carbon/charts-svelte/styles.css';
  import '../../app.pcss';

  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import Header from './components/header.svelte';
  import Navbar from './components/navbar.svelte';
  import { ensureServiceWorker } from '$lib/push/subscribe';
  import type { LayoutData } from './$types';

  interface Props {
    data: LayoutData;
    children?: Snippet;
  }

  let { data, children }: Props = $props();

  onMount(() => {
    // Register once on the first authed page load. The SW is small and
    // serves the cached app shell, so any authed route works. Failures are
    // non-fatal — push is opt-in via the settings page.
    ensureServiceWorker().catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
</script>

<!--
  Offset native anchor scrolling (goto('#step'), or landing on a URL
  with a hash) so the target isn't occluded by the fixed header. Lives
  in svelte:head so SvelteKit ties it to the (authed) layout's lifetime
  — added on SSR'd pages, removed when the user navigates to /login or
  /admin (which use different layouts and don't have this header).
-->
<svelte:head>
  <style>
    html {
      scroll-padding-top: calc(
        env(safe-area-inset-top) + var(--header-height) + 1rem
      );
    }
  </style>
</svelte:head>

<Header
  organizations={data.organizations}
  displayName={data.displayName}
  username={data.username}
  defaultOrgSlug={data.defaultOrgSlug}
/>
<main
  class="mx-auto max-w-screen-sm overflow-auto p-4 pb-24"
  style="padding-top: calc(env(safe-area-inset-top) + var(--header-height) + 1rem);"
>
  {@render children?.()}
</main>
<Navbar
  defaultOrgSlug={data.defaultOrgSlug}
  defaultLeagueSlug={data.defaultLeagueSlug}
  defaultOrgId={data.defaultOrgId}
  defaultLeagueId={data.defaultLeagueId}
  defaultLeaguePlayerId={data.defaultLeaguePlayerId}
/>

<style lang="postcss">
  :global(body) {
    @apply min-h-screen;
  }
</style>
