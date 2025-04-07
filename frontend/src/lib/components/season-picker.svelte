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
  import type { SeasonDto } from '../../api/models/SeasonDto';

  interface Props {
    seasons: SeasonDto[];
    currentSeason: SeasonDto;
  }

  let { seasons, currentSeason }: Props = $props();

  const seasonId = page.url.searchParams.get('season');
  let selectedSeason = $state<SeasonDto>(
    seasonId
      ? (seasons.find((s: SeasonDto) => s.id === parseInt(seasonId)) ??
          currentSeason)
      : currentSeason
  );

  function mapSeasonToTheme(
    season: SeasonDto,
    currentSeason: SeasonDto
  ): NonNullable<SelectRootProps['items']>[number] {
    if (season.id === currentSeason.id) {
      return {
        label: `Current Season`,
        value: season.id.toString(),
      };
    }

    return {
      label: `Season ${season.id}`,
      value: season.id.toString(),
    };
  }

  let seasonValues = $derived(
    seasons.map((season) => mapSeasonToTheme(season, currentSeason))
  );

  function getSeason(): string {
    const season =
      seasons.find((s: SeasonDto) => s.id === selectedSeason.id) ??
      currentSeason;
    return season.id.toString();
  }

  function setSeason(value: string) {
    const season = seasons.find((s: SeasonDto) => s.id === parseInt(value));
    handleSeasonChange(season ?? currentSeason);
  }

  function handleSeasonChange(season: SeasonDto) {
    selectedSeason = season;
    const url = new URL(page.url);
    if (season.id === currentSeason.id) {
      url.searchParams.delete('season');
    } else {
      url.searchParams.set('season', season.id.toString());
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
    aria-label="Select a theme"
  >
    {mapSeasonToTheme(selectedSeason, currentSeason).label}
    <ChevronsUpDown class="text-muted-foreground ml-2 h-4 w-4" />
  </Select.Trigger>

  <Select.Portal>
    <Select.Content
      class="border-muted bg-background z-50 mt-2 max-h-96 w-full overflow-auto rounded-md border shadow-lg focus:outline-none"
      sideOffset={10}
      align="end"
    >
      <Select.ScrollUpButton
        class="flex w-full items-center justify-center py-1"
      >
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

      <Select.ScrollDownButton
        class="flex w-full items-center justify-center py-1"
      >
        <ChevronsDown class="text-muted-foreground h-3 w-3" />
      </Select.ScrollDownButton>
    </Select.Content>
  </Select.Portal>
</Select.Root>
