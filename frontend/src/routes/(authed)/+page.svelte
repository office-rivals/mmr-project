<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Building2, Ticket, Trophy } from 'lucide-svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
</script>

{#if data.organizations.length === 0}
  <div class="flex flex-col items-center justify-center gap-6 py-16 text-center">
    <Building2 class="text-muted-foreground h-16 w-16" />
    <div class="flex flex-col gap-2">
      <h1 class="text-3xl font-bold">Welcome to Office Rivals</h1>
      <p class="text-muted-foreground max-w-md">
        You're not a member of any organizations yet. Ask someone to invite you, or join with an invite code.
      </p>
    </div>
    <Button href="/join" variant="outline" class="gap-2">
      <Ticket class="h-4 w-4" />
      Join with Invite Code
    </Button>
  </div>
{:else}
  <div class="flex flex-col gap-6">
    <PageTitle>Your Organizations</PageTitle>
    <div class="flex flex-col gap-4">
      {#each data.organizations as org}
        <div class="bg-card rounded-lg border p-4">
          <h2 class="text-xl font-semibold">{org.name}</h2>
          {#if org.leagues?.length > 0}
            <div class="mt-3 flex flex-col gap-2">
              {#each org.leagues as league}
                <Button variant="outline" href="/{org.slug}/{league.slug}" class="justify-start gap-2">
                  <Trophy class="h-4 w-4" />
                  {league.name}
                </Button>
              {/each}
            </div>
          {:else}
            <p class="text-muted-foreground mt-2 text-sm">No leagues yet.</p>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
