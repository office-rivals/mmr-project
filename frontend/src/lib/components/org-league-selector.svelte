<script lang="ts">
  import { page } from '$app/state';
  import { ChevronDown, Building2, Trophy } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import type {
    MeOrganizationResponse,
    MeLeagueResponse,
  } from '../../api-v3/models/index';

  interface Props {
    currentOrg?: MeOrganizationResponse;
    currentLeague?: MeLeagueResponse;
    organizations: MeOrganizationResponse[];
  }

  let { currentOrg, currentLeague, organizations }: Props = $props();
  let open = $state(false);

  function toggle() {
    open = !open;
  }

  function close() {
    open = false;
  }

  function navigate(orgSlug: string, leagueSlug: string) {
    close();
    window.location.href = `/${orgSlug}/${leagueSlug}`;
  }
</script>

<div class="relative">
  <Button variant="ghost" class="gap-2 text-sm" onclick={toggle}>
    {#if currentOrg && currentLeague}
      <Building2 class="h-4 w-4" />
      <span class="max-w-[120px] truncate">{currentOrg.name}</span>
      <span class="text-muted-foreground">/</span>
      <Trophy class="h-3 w-3" />
      <span class="max-w-[120px] truncate">{currentLeague.name}</span>
    {:else}
      <Building2 class="h-4 w-4" />
      <span>Select org & league</span>
    {/if}
    <ChevronDown class="h-4 w-4" />
  </Button>

  {#if open}
    <button class="fixed inset-0 z-40" onclick={close} aria-label="Close menu"
    ></button>
    <div
      class="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-md"
    >
      {#each organizations as org}
        <div class="border-b border-border p-2 last:border-b-0">
          <div
            class="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase text-muted-foreground"
          >
            <Building2 class="h-3 w-3" />
            {org.name}
          </div>
          {#each org.leagues as league}
            {@const isActive =
              currentOrg?.slug === org.slug &&
              currentLeague?.slug === league.slug}
            <button
              class="w-full rounded px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent {isActive
                ? 'bg-accent font-medium'
                : ''}"
              onclick={() => navigate(org.slug, league.slug)}
            >
              <div class="flex items-center gap-2">
                <Trophy class="h-3 w-3" />
                {league.name}
              </div>
            </button>
          {/each}
        </div>
      {/each}
      {#if organizations.length === 0}
        <div class="p-4 text-center text-sm text-muted-foreground">
          No organizations found
        </div>
      {/if}
    </div>
  {/if}
</div>
