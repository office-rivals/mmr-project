<script lang="ts">
  import '@carbon/charts-svelte/styles.css';
  import '../../app.pcss';

  import type { Snippet } from 'svelte';
  import Header from './components/header.svelte';
  import Navbar from './components/navbar.svelte';
  import type { LayoutData } from './$types';

  interface Props {
    data: LayoutData;
    children?: Snippet;
  }

  let { data, children }: Props = $props();
</script>

<Header
  organizations={data.organizations}
  displayName={data.displayName}
  username={data.username}
  email={data.email}
  defaultOrgSlug={data.defaultOrgSlug}
  defaultLeagueSlug={data.defaultLeagueSlug}
/>
<main class="mx-auto max-w-screen-sm overflow-auto p-4 pb-24 pt-20">
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
