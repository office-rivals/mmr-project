<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Select, type SelectRootProps } from 'bits-ui';
  import {
    Check,
    ChevronsDown,
    ChevronsUp,
    ChevronsUpDown,
  } from 'lucide-svelte';
  import type { SeasonResponse } from '../../api-v3/models';

  interface Props {
    seasons: SeasonResponse[];
    currentSeason: SeasonResponse;
  }

  let { seasons, currentSeason }: Props = $props();

  const seasonId = page.url.searchParams.get('season');
  let selectedSeason = $state<SeasonResponse>(
    seasonId
      ? (seasons.find((s) => s.id === seasonId) ?? currentSeason)
      : currentSeason
  );

  function seasonLabel(season: SeasonResponse, currentSeason: SeasonResponse): string {
    if (season.id === currentSeason.id) return 'Current Season';
    return new Date(season.startsAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
    });
  }

  function mapSeasonToItem(
    season: SeasonResponse,
    currentSeason: SeasonResponse
  ): NonNullable<SelectRootProps['items']>[number] {
    return {
      label: seasonLabel(season, currentSeason),
      value: season.id,
    };
  }

  let seasonValues = $derived(
    seasons.map((season) => mapSeasonToItem(season, currentSeason))
  );

  function getSeason(): string {
    return (seasons.find((s) => s.id === selectedSeason.id) ?? currentSeason).id;
  }

  function setSeason(value: string) {
    const season = seasons.find((s) => s.id === value);
    handleSeasonChange(season ?? currentSeason);
  }

  function handleSeasonChange(season: SeasonResponse) {
    selectedSeason = season;
    const url = new URL(page.url);
    if (season.id === currentSeason.id) {
      url.searchParams.delete('season');
    } else {
      url.searchParams.set('season', season.id);
    }
    goto(url.toString(), { replaceState: true, invalidateAll: true });
  }
</script>

<Select.Root
  type="single"
  bind:value={getSeason, setSeason}
  items={seasonValues}
>
  <Select.Trigger
    class="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring ring-offset-background flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    aria-label="Select a season"
  >
    {seasonLabel(selectedSeason, currentSeason)}
    <ChevronsUpDown class="text-muted-foreground ml-2 h-4 w-4" />
  </Select.Trigger>

  <Select.Portal>
    <Select.Content
      class="border-muted bg-background z-50 mt-2 max-h-96 w-full overflow-auto rounded-md border shadow-lg focus:outline-none"
      sideOffset={10}
      align="end"
    >
      <Select.ScrollUpButton class="flex w-full items-center justify-center py-1">
        <ChevronsUp class="text-muted-foreground h-3 w-3" />
      </Select.ScrollUpButton>

      <Select.Viewport class="p-1">
        {#each seasonValues as season, i (i + season.value)}
          <Select.Item
            class="hover:bg-muted data-[highlighted]:bg-muted data-[highlighted]:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground flex h-10 w-full items-center justify-between rounded-md px-3 py-2 text-sm capitalize disabled:cursor-not-allowed disabled:opacity-50"
            value={season.value}
            label={season.label}
            disabled={season.disabled}
          >
            {#snippet children({ selected })}
              {season.label}
              {#if selected}
                <Check class="text-ring ml-2 mr-1 h-4 w-4" />
              {/if}
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>

      <Select.ScrollDownButton class="flex w-full items-center justify-center py-1">
        <ChevronsDown class="text-muted-foreground h-3 w-3" />
      </Select.ScrollDownButton>
    </Select.Content>
  </Select.Portal>
</Select.Root>
