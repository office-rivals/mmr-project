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

  let seasonNumbers = $derived(
    new Map(seasons.map((season, index) => [season.id, seasons.length - index]))
  );

  function seasonLabel(season: SeasonResponse): string {
    return `Season ${seasonNumbers.get(season.id) ?? '?'}`;
  }

  function mapSeasonToItem(
    season: SeasonResponse
  ): NonNullable<SelectRootProps['items']>[number] {
    return {
      label: seasonLabel(season),
      value: season.id,
    };
  }

  let seasonValues = $derived(seasons.map(mapSeasonToItem));

  function getSeason(): string {
    return (seasons.find((s) => s.id === selectedSeason.id) ?? currentSeason)
      .id;
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
    class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    aria-label="Select a season"
  >
    {seasonLabel(selectedSeason)}
    <ChevronsUpDown class="ml-2 h-4 w-4 text-muted-foreground" />
  </Select.Trigger>

  <Select.Portal>
    <Select.Content
      class="z-50 mt-2 max-h-96 w-full overflow-auto rounded-md border border-muted bg-background shadow-lg focus:outline-none"
      sideOffset={10}
      align="end"
    >
      <Select.ScrollUpButton
        class="flex w-full items-center justify-center py-1"
      >
        <ChevronsUp class="h-3 w-3 text-muted-foreground" />
      </Select.ScrollUpButton>

      <Select.Viewport class="p-1">
        {#each seasonValues as season, i (i + season.value)}
          <Select.Item
            class="flex h-10 w-full items-center justify-between rounded-md px-3 py-2 text-sm capitalize hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 data-[highlighted]:bg-muted data-[state=checked]:bg-accent data-[highlighted]:text-foreground data-[state=checked]:text-accent-foreground"
            value={season.value}
            label={season.label}
            disabled={season.disabled}
          >
            {#snippet children({ selected })}
              {season.label}
              {#if selected}
                <Check class="ml-2 mr-1 h-4 w-4 text-ring" />
              {/if}
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>

      <Select.ScrollDownButton
        class="flex w-full items-center justify-center py-1"
      >
        <ChevronsDown class="h-3 w-3 text-muted-foreground" />
      </Select.ScrollDownButton>
    </Select.Content>
  </Select.Portal>
</Select.Root>
