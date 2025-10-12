<script lang="ts">
  import { browser } from '$app/environment';
  import PageTitle from '$lib/components/page-title.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import { getRandomTeamsSessionStorageKey } from '$lib/util/session';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let players = $state([
    data.players[0] ?? '',
    data.players[1] ?? '',
    data.players[2] ?? '',
    data.players[3] ?? '',
  ]);

  var teams: string[][] = $state(data.teams);

  const tabs = [
    { id: 'teams', label: 'Team Generator' },
    { id: 'touch', label: 'Finger Randomizer' },
  ] as const;
  type TabId = (typeof tabs)[number]['id'];
  let activeTab: TabId = $state('teams');

  interface TouchPoint {
    identifier: number;
    x: number;
    y: number;
    color: 'white' | 'brown' | null;
  }

  let touchPoints = $state<TouchPoint[]>([]);
  let selectionActive = $state(false);
  let touchArea = $state<HTMLDivElement | null>(null);
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  const inactivityDelay = 5000;
  let supportsTouch = $state(false);

  if (browser) {
    supportsTouch = (navigator.maxTouchPoints ?? 0) > 0;
  }

  function generateTeams() {
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    teams = [shuffledPlayers.slice(0, 2), shuffledPlayers.slice(2, 4)];

    if (browser) {
      sessionStorage.setItem(
        getRandomTeamsSessionStorageKey(players),
        JSON.stringify(teams)
      );
    }
  }

  function resetTouchInteraction() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
    touchPoints = [];
    selectionActive = false;
  }

  $effect(() => {
    if (activeTab === 'teams') {
      resetTouchInteraction();
    }
  });

  function getRelativePosition(touch: Touch) {
    const rect = touchArea?.getBoundingClientRect();
    if (!rect) {
      return { x: touch.clientX, y: touch.clientY };
    }
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  function clearColors() {
    selectionActive = false;
    touchPoints = touchPoints.map((point) => ({ ...point, color: null }));
  }

  function assignRandomColors() {
    if (touchPoints.length < 4) {
      clearColors();
      return;
    }

    const indices = touchPoints.map((_, idx) => idx);
    indices.sort(() => Math.random() - 0.5);

    const white = new Set(indices.slice(0, 2));
    const brown = new Set(indices.slice(2, 4));

    selectionActive = true;
    touchPoints = touchPoints.map((point, index) => {
      let color: TouchPoint['color'] = null;
      if (white.has(index)) {
        color = 'white';
      } else if (brown.has(index)) {
        color = 'brown';
      }
      return { ...point, color };
    });
  }

  function startInactivityTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }

    if (touchPoints.length === 0) {
      inactivityTimer = null;
      return;
    }

    inactivityTimer = setTimeout(() => {
      assignRandomColors();
    }, inactivityDelay);
  }

  function handleTouchStart(event: TouchEvent) {
    let added = false;
    for (const touch of Array.from(event.changedTouches)) {
      if (!touchPoints.some((point) => point.identifier === touch.identifier)) {
        const { x, y } = getRelativePosition(touch);
        touchPoints = [
          ...touchPoints,
          { identifier: touch.identifier, x, y, color: null },
        ];
        added = true;
      }
    }

    if (added) {
      clearColors();
      startInactivityTimer();
    }
  }

  function handleTouchMove(event: TouchEvent) {
    const updates = new Map(
      Array.from(event.changedTouches).map((touch) => [touch.identifier, touch])
    );

    if (updates.size === 0) {
      return;
    }

    touchPoints = touchPoints.map((point) => {
      const touch = updates.get(point.identifier);
      if (!touch) {
        return point;
      }
      const { x, y } = getRelativePosition(touch);
      return { ...point, x, y };
    });
  }

  function removeTouches(touches: TouchList) {
    const identifiers = new Set(Array.from(touches).map((touch) => touch.identifier));
    if (identifiers.size === 0) {
      return;
    }

    touchPoints = touchPoints.filter((point) => !identifiers.has(point.identifier));
    if (touchPoints.length === 0) {
      resetTouchInteraction();
      return;
    }

    clearColors();
    startInactivityTimer();
  }

  function handleTouchEnd(event: TouchEvent) {
    removeTouches(event.changedTouches);
  }

  function handleTouchCancel(event: TouchEvent) {
    removeTouches(event.changedTouches);
  }
</script>

<div class="flex flex-col gap-6">
  <PageTitle>Random Team Generator</PageTitle>

  <div class="flex gap-2 rounded-md bg-muted p-1 text-sm">
    {#each tabs as tab}
      <button
        type="button"
        class={`flex-1 rounded-md px-3 py-2 font-medium transition-colors ${
          activeTab === tab.id
            ? 'bg-background text-primary shadow'
            : 'text-muted-foreground hover:bg-background/80'
        }`}
        onclick={() => (activeTab = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#if activeTab === 'teams'}
    <div class="flex flex-col gap-8">
      <div class="grid grid-cols-2 gap-4">
        {#each players as player, idx}
          <div class="flex flex-col gap-2">
            <Label for="player-{idx}">Player {idx + 1}</Label>
            <Input id="player-{idx}" bind:value={players[idx]} />
          </div>
        {/each}
      </div>
      <Button
        type="button"
        disabled={players.some((p) => p == null || p.trim() === '')}
        onclick={generateTeams}>Generate Teams</Button
      >
      {#if teams.length === 2}
        <div class="flex flex-row gap-4 text-center">
          <div class="flex flex-1 flex-col">
            <h3 class="text-2xl">Team 1</h3>
            <ul>
              {#each teams[0] as player}
                <li>{player}</li>
              {/each}
            </ul>
          </div>
          <div class="flex-s bg-border min-h-full w-px"></div>
          <div class="flex flex-1 flex-col">
            <h3 class="text-2xl">Team 2</h3>
            <ul>
              {#each teams[1] as player}
                <li>{player}</li>
              {/each}
            </ul>
          </div>
        </div>
        <Button
          href="/submit?player1={teams[0][0]}&player2={teams[0][1]}&player3={teams[1][0]}&player4={teams[1][1]}"
        >
          Submit result
        </Button>
      {/if}
    </div>
  {:else}
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        This mode works best on touch devices. Place at least four fingers on the
        screen and hold still—after five seconds without any new fingers, two will get a
        white bubble and two will get a brown bubble.
      </p>
      {#if !supportsTouch}
        <p class="text-sm font-medium text-destructive">
          We couldn't detect touch support on this device. Try opening this page on a
          phone or tablet.
        </p>
      {/if}
      <div
        bind:this={touchArea}
        class="relative flex h-[420px] w-full flex-1 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 touch-none"
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
        ontouchcancel={handleTouchCancel}
      >
        <span class="pointer-events-none text-center text-sm text-muted-foreground">
          Touch and hold the screen to add players.
        </span>

        {#each touchPoints as point (point.identifier)}
          {#if !selectionActive || point.color !== null}
            <span
              class={`pointer-events-none absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-sm font-semibold shadow ${
                point.color === 'white'
                  ? 'bg-white text-foreground'
                  : point.color === 'brown'
                    ? 'bg-amber-800 text-white'
                    : 'bg-primary/70 text-primary-foreground'
              }`}
              style={`left: ${point.x}px; top: ${point.y}px;`}
            >
              {#if selectionActive}
                {point.color === 'white' ? 'White' : point.color === 'brown' ? 'Brown' : ''}
              {:else}
                Player
              {/if}
            </span>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>
