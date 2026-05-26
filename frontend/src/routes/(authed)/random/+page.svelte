<script lang="ts">
  import { browser } from '$app/environment';
  import PageTitle from '$lib/components/page-title.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import { getRandomTeamsSessionStorageKey } from '$lib/util/session';
  import { Hand, Keyboard, RotateCcw } from 'lucide-svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const MIN_TOUCHES = 4;
  const COUNTDOWN_SECONDS = 3;
  const TEAM_SIZE = 2;

  type Tab = 'names' | 'touch';

  // SSR can't know if the device is touch-capable. Render the names form by
  // default and flip on hydration. `isTouchDevice` stays `null` until we know,
  // so we can avoid showing either UI in a wrong state during the first paint.
  let isTouchDevice = $state<boolean | null>(null);
  let activeTab = $state<Tab>('names');
  let userSwitchedTab = $state(false);

  $effect(() => {
    if (!browser) return;
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const apply = () => {
      const touch = mq.matches || navigator.maxTouchPoints > 0;
      isTouchDevice = touch;
      if (touch && activeTab === 'names' && !userSwitchedTab) {
        activeTab = 'touch';
      }
      if (!touch) {
        activeTab = 'names';
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  });

  function selectTab(tab: Tab) {
    activeTab = tab;
    userSwitchedTab = true;
    // Switching away from the touch surface mid-countdown should clear it,
    // otherwise the previous gesture's state would leak when the user comes
    // back. (Also: any fingers still on the screen will fire touchend later
    // and we want them to no-op.)
    if (tab === 'names') {
      resetTouchRandomizer();
    }
  }

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
    color: 'white' | 'red' | null;
  }

  let touches = $state<TouchMarker[]>([]);
  let countdown = $state<number | null>(null);
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let showingResult = $state(false);

  $effect(() => {
    return () => {
      if (countdownTimer !== null) {
        clearInterval(countdownTimer);
      }
    };
  });

  function handleTouchStart(event: TouchEvent) {
    // Bail out *before* preventDefault — once colors are assigned, taps on
    // the "Go again" button (which lives inside the touch surface) need to
    // synthesize a click, and iOS suppresses synthesized clicks if any
    // touchstart handler in the bubble path called preventDefault.
    if (showingResult) {
      return;
    }

    event.preventDefault();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

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

    // Any finger added/removed during placement restarts the countdown so the
    // user has a beat to settle before colors get assigned.
    if (touches.length >= MIN_TOUCHES) {
      resetCountdown();
    }
  }

  function handleTouchMove(event: TouchEvent) {
    // Markers freeze once colors are assigned. Skip preventDefault so the
    // browser keeps synthesizing the click for "Go again" — `touch-action:
    // none` on the surface still blocks scroll/zoom for stuck-down fingers.
    if (showingResult) {
      return;
    }

    event.preventDefault();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const existingTouch = touches.find(
        (t) => t.identifier === touch.identifier
      );

      if (existingTouch) {
        existingTouch.x = touch.clientX - rect.left;
        existingTouch.y = touch.clientY - rect.top;
      }
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (showingResult) {
      return;
    }

    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const index = touches.findIndex((t) => t.identifier === touch.identifier);

      if (index !== -1) {
        touches.splice(index, 1);
      }
    }

    if (touches.length < MIN_TOUCHES) {
      if (countdownTimer !== null) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      countdown = null;
    } else {
      // Still above threshold — restart so the user gets a fresh beat after
      // changing the lineup.
      resetCountdown();
    }
  }

  function resetCountdown() {
    if (countdownTimer !== null) {
      clearInterval(countdownTimer);
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

    if (touchCount < MIN_TOUCHES) {
      countdown = null;
      showingResult = false;
      return;
    }

    const indices = touches.map((_, i) => i);
    const shuffled = fisherYatesShuffle(indices);

    for (let i = 0; i < TEAM_SIZE; i++) {
      touches[shuffled[i]].color = 'white';
    }
    for (let i = 0; i < TEAM_SIZE; i++) {
      touches[shuffled[TEAM_SIZE + i]].color = 'red';
    }

    // Intentionally do NOT filter out the uncolored extras. They are still
    // active touches in the browser; we need to keep their identifiers in
    // `touches` so the (suppressed) touchend events still match an entry.
    // The render branch hides null-color markers during the result phase.

    countdown = null;
    showingResult = true;
  }

  function resetTouchRandomizer() {
    touches = [];
    countdown = null;
    showingResult = false;
    if (countdownTimer !== null) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  const headerSubtitle = $derived.by(() => {
    if (activeTab === 'names') {
      return teams.length === 2
        ? 'Tap generate again to reshuffle.'
        : 'Type four names and tap generate.';
    }
    if (showingResult) {
      return 'Teams ready — tap "Go again" to reset';
    }
    if (countdown !== null && countdown > 0) {
      return 'Hold still…';
    }
    if (touches.length === 0) {
      return `Place at least ${MIN_TOUCHES} fingers on the screen`;
    }
    if (touches.length < MIN_TOUCHES) {
      return `${touches.length} of ${MIN_TOUCHES} fingers — keep going`;
    }
    return `${touches.length} fingers down`;
  });

  const allPlayersFilled = $derived(
    !players.some((p) => p == null || p.trim() === '')
  );
</script>

{#snippet pillTabs()}
  <div
    class="flex items-center gap-1 rounded-full border bg-muted p-1 text-xs"
    role="tablist"
    aria-label="Randomizer mode"
  >
    <button
      role="tab"
      aria-selected={activeTab === 'touch'}
      class="flex items-center gap-1 rounded-full px-3 py-1 transition-colors {activeTab ===
      'touch'
        ? 'bg-background font-semibold shadow-sm'
        : 'text-muted-foreground'}"
      onclick={() => selectTab('touch')}
    >
      <Hand class="h-3.5 w-3.5" />
      Touch
    </button>
    <button
      role="tab"
      aria-selected={activeTab === 'names'}
      class="flex items-center gap-1 rounded-full px-3 py-1 transition-colors {activeTab ===
      'names'
        ? 'bg-background font-semibold shadow-sm'
        : 'text-muted-foreground'}"
      onclick={() => selectTab('names')}
    >
      <Keyboard class="h-3.5 w-3.5" />
      Names
    </button>
  </div>
{/snippet}

{#snippet namesForm()}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {#each players as _, idx}
      <div class="flex flex-col gap-2">
        <Label for="player-{idx}">Player {idx + 1}</Label>
        <Input id="player-{idx}" bind:value={players[idx]} />
      </div>
    {/each}
  </div>
  <Button type="button" disabled={!allPlayersFilled} onclick={generateTeams}
    >Generate Teams</Button
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
      <div class="min-h-full w-px self-stretch bg-border"></div>
      <div class="flex flex-1 flex-col">
        <h3 class="text-2xl">Team 2</h3>
        <ul>
          {#each teams[1] as player}
            <li>{player}</li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
{/snippet}

<!--
  Touch devices: full-bleed overlay with a sticky header that holds the title,
  status copy, and the Touch/Names pill toggle. The body below the header swaps
  between the touch surface and the names form so the chrome never jumps.

  Desktop: render the original names form below the page title.
-->

{#if isTouchDevice === true}
  <div
    class="fixed inset-x-0 z-20 flex flex-col bg-background"
    style="top: calc(env(safe-area-inset-top) + 4rem); bottom: calc(env(safe-area-inset-bottom) + 64px);"
  >
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-4 py-3"
    >
      <div class="flex min-w-0 flex-col">
        <h1 class="text-lg font-bold leading-tight">Random Teams</h1>
        <p
          class="line-clamp-2 min-h-[2lh] text-xs leading-snug text-muted-foreground"
        >
          {headerSubtitle}
        </p>
      </div>
      {@render pillTabs()}
    </header>

    {#if activeTab === 'touch'}
      <div
        role="application"
        aria-label="Touch randomizer surface"
        class="relative flex-1 touch-none select-none overflow-hidden bg-muted"
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
        ontouchcancel={handleTouchEnd}
      >
        {#if touches.length === 0 && !showingResult}
          <div
            class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center"
          >
            <div
              class="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-primary/40 bg-background/60"
            >
              <Hand class="h-10 w-10 text-primary" />
            </div>
            <p class="text-2xl font-bold">Place your fingers</p>
            <p class="max-w-xs text-sm text-muted-foreground">
              At least {MIN_TOUCHES}. After a {COUNTDOWN_SECONDS}-second
              countdown, two random fingers become
              <span class="font-semibold text-foreground">white team</span>
              and two become
              <span class="font-semibold text-foreground">red team</span>.
            </p>
          </div>
        {/if}

        {#if countdown !== null && countdown > 0}
          <div
            class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <div
              class="animate-pulse text-[12rem] font-bold leading-none text-primary/80"
            >
              {countdown}
            </div>
          </div>
        {/if}

        {#if showingResult}
          <div
            class="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2 px-6 text-center"
          >
            <p class="text-sm uppercase tracking-widest text-muted-foreground">
              Teams
            </p>
            <div class="flex items-center gap-3 text-2xl font-bold">
              <span class="inline-flex items-center gap-2">
                <span
                  class="h-4 w-4 rounded-full border-2 border-foreground bg-white"
                ></span>
                White
              </span>
              <span class="text-muted-foreground">vs</span>
              <span class="inline-flex items-center gap-2">
                <span class="h-4 w-4 rounded-full bg-red-600"></span>
                Red
              </span>
            </div>
          </div>
        {/if}

        {#if showingResult}
          {@const whiteTouches = touches.filter((t) => t.color === 'white')}
          {@const redTouches = touches.filter((t) => t.color === 'red')}
          <svg
            class="pointer-events-none absolute inset-0 z-[5] h-full w-full"
            aria-hidden="true"
          >
            {#if whiteTouches.length === 2}
              <line
                x1={whiteTouches[0].x}
                y1={whiteTouches[0].y}
                x2={whiteTouches[1].x}
                y2={whiteTouches[1].y}
                stroke="#ffffff"
                stroke-width="6"
                stroke-linecap="round"
                stroke-dasharray="14 10"
              />
            {/if}
            {#if redTouches.length === 2}
              <line
                x1={redTouches[0].x}
                y1={redTouches[0].y}
                x2={redTouches[1].x}
                y2={redTouches[1].y}
                stroke="#dc2626"
                stroke-width="6"
                stroke-linecap="round"
                stroke-dasharray="14 10"
              />
            {/if}
          </svg>
        {/if}

        {#each touches as touch (touch.identifier)}
          {#if !(showingResult && touch.color === null)}
            <div
              class="pointer-events-none absolute flex h-28 w-28 items-center justify-center rounded-full border-4 shadow-lg transition-colors duration-500"
              class:pulse-scale={countdown !== null && countdown > 0}
              class:border-white={touch.color === 'white'}
              class:border-red-600={touch.color === 'red'}
              class:border-primary={touch.color === null}
              style="left: {touch.x}px; top: {touch.y}px; transform: translate(-50%, -50%);"
            >
              <div
                class="rounded-full transition-colors duration-500"
                class:bg-white={touch.color === 'white'}
                class:bg-red-600={touch.color === 'red'}
                class:bg-primary={touch.color === null}
                class:opacity-30={touch.color === null}
                style="width: 88px; height: 88px;"
              ></div>
            </div>
          {/if}
        {/each}

        {#if showingResult}
          <button
            class="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg"
            onclick={resetTouchRandomizer}
          >
            <RotateCcw class="h-4 w-4" />
            Go again
          </button>
        {/if}
      </div>
    {:else}
      <div class="flex flex-1 flex-col gap-6 overflow-y-auto bg-background p-4">
        {@render namesForm()}
      </div>
    {/if}
  </div>
{:else}
  <div class="flex flex-col gap-8">
    <PageTitle>Random Team Generator</PageTitle>
    {@render namesForm()}
  </div>
{/if}

<style>
  @keyframes pulse-scale {
    0%,
    100% {
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
