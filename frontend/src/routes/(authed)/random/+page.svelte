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

  const REQUIRED_TOUCHES = 4;
  const COUNTDOWN_SECONDS = 3;
  const RESULT_DISPLAY_MS = 5000;
  const TEAM_SIZE = 2;

  type Tab = 'names' | 'touch';
  let activeTab = $state<Tab>('names');

  function fisherYatesShuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  let players = $state([
    data.players[0] ?? '',
    data.players[1] ?? '',
    data.players[2] ?? '',
    data.players[3] ?? '',
  ]);

  var teams: string[][] = $state(data.teams);
  function generateTeams() {
    const shuffledPlayers = fisherYatesShuffle(players);
    teams = [shuffledPlayers.slice(0, 2), shuffledPlayers.slice(2, 4)];

    if (browser) {
      sessionStorage.setItem(
        getRandomTeamsSessionStorageKey(players),
        JSON.stringify(teams)
      );
    }
  }

  interface TouchMarker {
    identifier: number;
    x: number;
    y: number;
    color: 'white' | 'brown' | null;
  }

  let touches = $state<TouchMarker[]>([]);
  let countdown = $state<number | null>(null);
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;
  let showingResult = $state(false);
  let isMobile = $state(false);

  $effect(() => {
    if (browser) {
      isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
  });

  $effect(() => {
    return () => {
      if (countdownTimer !== null) {
        clearInterval(countdownTimer);
      }
      if (resetTimer !== null) {
        clearTimeout(resetTimer);
      }
    };
  });

  function handleTouchStart(event: TouchEvent) {
    event.preventDefault();

    if (showingResult) {
      return;
    }

    const rect = (event.target as HTMLElement).getBoundingClientRect();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      touches.push({
        identifier: touch.identifier,
        x,
        y,
        color: null,
      });
    }

    if (touches.length >= REQUIRED_TOUCHES) {
      resetCountdown();
    }
  }

  function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    const rect = (event.target as HTMLElement).getBoundingClientRect();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const existingTouch = touches.find(t => t.identifier === touch.identifier);

      if (existingTouch) {
        existingTouch.x = touch.clientX - rect.left;
        existingTouch.y = touch.clientY - rect.top;
      }
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    event.preventDefault();

    if (showingResult) {
      return;
    }

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const index = touches.findIndex(t => t.identifier === touch.identifier);

      if (index !== -1) {
        touches.splice(index, 1);
      }
    }

    if (touches.length < REQUIRED_TOUCHES) {
      if (countdownTimer !== null) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      countdown = null;
    }
  }

  function resetCountdown() {
    if (countdownTimer !== null) {
      clearInterval(countdownTimer);
    }
    if (resetTimer !== null) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }

    showingResult = false;
    countdown = COUNTDOWN_SECONDS;
    countdownTimer = setInterval(() => {
      if (countdown !== null && countdown > 0) {
        countdown--;
        if (countdown === 0) {
          assignColors();
          if (countdownTimer !== null) {
            clearInterval(countdownTimer);
          }
        }
      }
    }, 1000);
  }

  function assignColors() {
    const touchCount = touches.length;

    if (touchCount < REQUIRED_TOUCHES) {
      countdown = null;
      showingResult = false;
      return;
    }

    const indices = touches.map((_, i) => i);
    const shuffled = fisherYatesShuffle(indices);

    const whiteCount = Math.min(TEAM_SIZE, touchCount);
    const brownCount = Math.min(TEAM_SIZE, Math.max(0, touchCount - TEAM_SIZE));

    for (let i = 0; i < whiteCount; i++) {
      touches[shuffled[i]].color = 'white';
    }

    for (let i = 0; i < brownCount; i++) {
      touches[shuffled[whiteCount + i]].color = 'brown';
    }

    touches = touches.filter(t => t.color !== null);

    countdown = null;
    showingResult = true;

    if (resetTimer !== null) {
      clearTimeout(resetTimer);
    }
    resetTimer = setTimeout(() => {
      resetTouchRandomizer();
    }, RESULT_DISPLAY_MS);
  }

  function resetTouchRandomizer() {
    touches = [];
    countdown = null;
    showingResult = false;
    if (countdownTimer !== null) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (resetTimer !== null) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
  }
</script>

<style>
  @keyframes pulse-scale {
    0%, 100% {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.15);
    }
  }

  .pulse-scale {
    animation: pulse-scale 1.5s ease-in-out infinite;
  }
</style>

<div class="flex flex-col gap-8">
  <PageTitle>Random Team Generator</PageTitle>

  <div class="flex gap-2 border-b" role="tablist" aria-label="Randomizer mode">
    <button
      role="tab"
      aria-selected={activeTab === 'names'}
      class="px-4 py-2 transition-colors {activeTab === 'names'
        ? 'border-b-2 border-primary font-semibold'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => activeTab = 'names'}
    >
      Names
    </button>
    <button
      role="tab"
      aria-selected={activeTab === 'touch'}
      class="px-4 py-2 transition-colors {activeTab === 'touch'
        ? 'border-b-2 border-primary font-semibold'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => activeTab = 'touch'}
    >
      Touch
    </button>
  </div>

  {#if activeTab === 'names'}
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
        <div class="self-stretch bg-border min-h-full w-px"></div>
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
  {:else}
    {#if !isMobile}
      <div class="bg-muted p-4 rounded-lg text-center">
        <p class="text-muted-foreground">This feature only works on mobile devices with touch support.</p>
      </div>
    {:else}
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted-foreground text-center">
          Place {REQUIRED_TOUCHES} fingers on the screen. After a {COUNTDOWN_SECONDS} second countdown, {TEAM_SIZE} fingers will be white team and {TEAM_SIZE} will be brown team.
        </p>

        <div
          class="relative w-full min-h-screen bg-muted touch-none select-none"
          ontouchstart={handleTouchStart}
          ontouchmove={handleTouchMove}
          ontouchend={handleTouchEnd}
          ontouchcancel={handleTouchEnd}
        >
          {#if countdown !== null && countdown > 0}
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div class="text-9xl font-bold text-primary animate-pulse">
                {countdown}
              </div>
            </div>
          {/if}

          {#each touches as touch (touch.identifier)}
            <div
              class="absolute w-24 h-24 rounded-full transition-colors duration-500 shadow-lg border-4 flex items-center justify-center"
              class:pulse-scale={countdown !== null}
              class:border-white={touch.color === 'white'}
              class:border-amber-900={touch.color === 'brown'}
              class:border-gray-300={touch.color === null}
              style="left: {touch.x}px; top: {touch.y}px; transform: translate(-50%, -50%);"
            >
              <div
                class="rounded-full transition-colors duration-500"
                class:bg-white={touch.color === 'white'}
                class:bg-amber-900={touch.color === 'brown'}
                class:bg-gray-300={touch.color === null}
                style="width: 72px; height: 72px;"
              ></div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
