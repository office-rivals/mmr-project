<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import { Building2, Home, Shield } from 'lucide-svelte';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let {
    data,
    children,
  }: {
    data: LayoutData;
    children?: Snippet;
  } = $props();

  const orgSlug = $derived($page.params.orgSlug ?? null);
  const currentOrg = $derived(
    orgSlug
      ? (data.me.organizations ?? []).find((o) => o.slug === orgSlug)
      : null
  );
</script>

<div class="min-h-screen bg-muted/30">
  <header class="sticky top-0 z-30 border-b bg-background">
    <div
      class="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-4 py-3"
    >
      <a href="/admin" class="flex items-center gap-2 font-semibold">
        <Shield class="h-5 w-5 text-primary" />
        <span>Admin</span>
      </a>

      {#if currentOrg}
        <span class="hidden text-sm text-muted-foreground sm:inline">
          / <span class="font-medium text-foreground">{currentOrg.name}</span>
        </span>
      {/if}

      <div class="ml-auto flex items-center gap-2">
        {#if currentOrg}
          <Button href={`/${currentOrg.slug}`} variant="ghost" size="sm">
            <Building2 class="mr-2 h-4 w-4" />
            Open Org
          </Button>
        {/if}
        <Button href="/" variant="ghost" size="sm">
          <Home class="mr-2 h-4 w-4" />
          Exit Admin
        </Button>
      </div>
    </div>
  </header>

  <main class="mx-auto max-w-screen-xl px-4 py-6">
    {@render children?.()}
  </main>
</div>
