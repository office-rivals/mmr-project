import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Hand, Keyboard, Plus, RotateCcw, Shuffle, X } from 'lucide-react';
import { Eyebrow } from '@/components/eyebrow';
import { PageTitle } from '@/components/page-title';
import { PlayerAvatar } from '@/components/player-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getRandomTeamsSessionStorageKey } from '@/lib/util/session';
import { cn } from '@/lib/utils';

const MIN_TOUCHES = 4;
const COUNTDOWN_SECONDS = 3;
const TEAM_SIZE = 2;
const PLAYER_COUNT = TEAM_SIZE * 2;

type Tab = 'names' | 'touch';

interface TouchMarker {
  identifier: number;
  /** Relative to the touch surface's bounding rect, not the viewport. */
  x: number;
  y: number;
  color: 'white' | 'red' | null;
}

function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * `?player=A&player=B` — repeated keys. TanStack's search decoder collapses a
 * single occurrence to a scalar and coerces numeric-looking values, so the
 * shape is normalised back to the `URLSearchParams.getAll()` string array the
 * page expects.
 *
 * The key is left off entirely when absent rather than defaulted to `[]`, so
 * the router never re-encodes a bare `/random` link as `/random?player=`.
 */
function validatePlayerSearch(search: Record<string, unknown>): {
  player?: string[];
} {
  const raw = search.player;
  if (raw === undefined || raw === null) return {};
  const list = Array.isArray(raw) ? raw : [raw];
  return { player: list.map((value) => String(value)) };
}

export const Route = createFileRoute('/_authed/random')({
  validateSearch: validatePlayerSearch,
  head: () => ({
    styles: [
      {
        // The animation and the marker's positioning share the `transform`
        // property, so the keyframes have to re-apply the centring translate
        // or every pulsing marker jumps to its top-left corner.
        children:
          '@keyframes pulse-scale{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.15)}}.pulse-scale{animation:pulse-scale 1.5s ease-in-out infinite}',
      },
    ],
  }),
  staticData: { wide: true },
  component: RandomPage,
});

/**
 * Owns the touch markers, the countdown and the result phase, and wires the
 * touch listeners **natively** with `{ passive: false }`.
 *
 * React's synthetic touch handlers are delegated from the root and cannot
 * cancel the default action, so `preventDefault()` on them is a no-op — the
 * surface would scroll the page under the user's fingers.
 */
function useTouchRandomizer(active: boolean) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The listeners are attached once per activation and read refs, so they
  // never observe a stale render's state.
  const touchesRef = useRef<TouchMarker[]>([]);
  const countdownRef = useRef<number | null>(null);
  const showingResultRef = useRef(false);

  const [touches, setTouches] = useState<TouchMarker[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showingResult, setShowingResult] = useState(false);

  const publishTouches = useCallback(() => {
    setTouches([...touchesRef.current]);
  }, []);
  const publishCountdown = useCallback((value: number | null) => {
    countdownRef.current = value;
    setCountdown(value);
  }, []);
  const publishShowingResult = useCallback((value: boolean) => {
    showingResultRef.current = value;
    setShowingResult(value);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    touchesRef.current = [];
    publishTouches();
    publishCountdown(null);
    publishShowingResult(false);
    clearTimer();
  }, [clearTimer, publishCountdown, publishShowingResult, publishTouches]);

  const assignColors = useCallback(() => {
    const markers = touchesRef.current;
    if (markers.length < MIN_TOUCHES) {
      publishCountdown(null);
      publishShowingResult(false);
      return;
    }

    const shuffled = fisherYatesShuffle(markers.map((_, index) => index));
    for (let i = 0; i < TEAM_SIZE; i++) markers[shuffled[i]].color = 'white';
    for (let i = 0; i < TEAM_SIZE; i++) {
      markers[shuffled[TEAM_SIZE + i]].color = 'red';
    }

    // Extras beyond four keep `color === null` and stay in the array on
    // purpose: they are still live browser touches whose identifiers must
    // match a later touchend. They are hidden at render time instead.
    publishTouches();
    publishCountdown(null);
    publishShowingResult(true);
  }, [publishCountdown, publishShowingResult, publishTouches]);

  const restartCountdown = useCallback(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    publishShowingResult(false);
    publishCountdown(COUNTDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      const current = countdownRef.current;
      if (current !== null && current > 0) {
        const next = current - 1;
        publishCountdown(next);
        if (next === 0) {
          assignColors();
          if (timerRef.current !== null) clearInterval(timerRef.current);
        }
      }
    }, 1000);
  }, [assignColors, publishCountdown, publishShowingResult]);

  useEffect(() => {
    const node = surfaceRef.current;
    if (!active || !node) return;

    const handleTouchStart = (event: TouchEvent) => {
      // Bail out *before* preventDefault — once colours are assigned, taps on
      // "Go again" (which lives inside this surface) need the synthesized
      // click, and iOS suppresses it if any touchstart handler in the bubble
      // path prevented the default. `touch-action: none` still blocks scroll.
      if (showingResultRef.current) return;
      event.preventDefault();

      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        touchesRef.current.push({
          identifier: touch.identifier,
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
          color: null,
        });
      }
      publishTouches();

      // Any finger added or removed during placement restarts the countdown so
      // the user gets a beat to settle before colours land.
      if (touchesRef.current.length >= MIN_TOUCHES) restartCountdown();
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (showingResultRef.current) return;
      event.preventDefault();

      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const existing = touchesRef.current.find(
          (marker) => marker.identifier === touch.identifier
        );
        if (existing) {
          existing.x = touch.clientX - rect.left;
          existing.y = touch.clientY - rect.top;
        }
      }
      publishTouches();
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (showingResultRef.current) return;
      event.preventDefault();

      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const index = touchesRef.current.findIndex(
          (marker) => marker.identifier === touch.identifier
        );
        if (index !== -1) touchesRef.current.splice(index, 1);
      }
      publishTouches();

      if (touchesRef.current.length < MIN_TOUCHES) {
        clearTimer();
        publishCountdown(null);
      } else {
        restartCountdown();
      }
    };

    node.addEventListener('touchstart', handleTouchStart, { passive: false });
    node.addEventListener('touchmove', handleTouchMove, { passive: false });
    node.addEventListener('touchend', handleTouchEnd, { passive: false });
    node.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    return () => {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
      node.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [active, clearTimer, publishCountdown, publishTouches, restartCountdown]);

  useEffect(() => clearTimer, [clearTimer]);

  return { surfaceRef, touches, countdown, showingResult, reset };
}

function RandomPage() {
  const { player = [] } = Route.useSearch();

  // `null` until hydration decides, so the server renders the desktop layout
  // and the touch overlay only ever appears client-side.
  const [isTouchDevice, setIsTouchDevice] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('names');
  const userSwitchedTab = useRef(false);

  const [players, setPlayers] = useState<string[]>(() =>
    player
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, PLAYER_COUNT)
  );
  const [teams, setTeams] = useState<string[][]>([]);
  const [draws, setDraws] = useState(0);

  const {
    surfaceRef,
    touches,
    countdown,
    showingResult,
    reset: resetTouchRandomizer,
  } = useTouchRandomizer(isTouchDevice === true && activeTab === 'touch');

  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const apply = () => {
      const touch = mq.matches || navigator.maxTouchPoints > 0;
      setIsTouchDevice(touch);
      if (touch) {
        setActiveTab((current) =>
          current === 'names' && !userSwitchedTab.current ? 'touch' : current
        );
      } else {
        setActiveTab('names');
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Read after mount, never during render: `sessionStorage` does not exist on
  // the server and reading it in the render path is a hydration mismatch.
  const urlPlayersKey = getRandomTeamsSessionStorageKey(player);
  useEffect(() => {
    const stored = sessionStorage.getItem(urlPlayersKey);
    if (!stored) return;
    try {
      setTeams(JSON.parse(stored) as string[][]);
      setDraws(1);
    } catch {
      // A corrupt entry just means no previous result to restore.
    }
  }, [urlPlayersKey]);

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    userSwitchedTab.current = true;
    // A stale gesture must not leak back when the user returns to the surface.
    if (tab === 'names') resetTouchRandomizer();
  }

  function changePlayers(next: string[]) {
    setPlayers(next);
    // A draw of a different line-up no longer applies.
    setTeams([]);
    setDraws(0);
  }

  function generateTeams() {
    const shuffled = fisherYatesShuffle(players);
    const next = [
      shuffled.slice(0, TEAM_SIZE),
      shuffled.slice(TEAM_SIZE, TEAM_SIZE * 2),
    ];
    setTeams(next);
    setDraws((n) => n + 1);
    // Keyed on the current players, not the URL params, and no URL update.
    sessionStorage.setItem(
      getRandomTeamsSessionStorageKey(players),
      JSON.stringify(next)
    );
  }

  const headerSubtitle = useMemo(() => {
    if (activeTab === 'names') {
      return teams.length === 2
        ? 'Shuffle again for a new draw.'
        : `Add ${PLAYER_COUNT} players to draw teams.`;
    }
    if (showingResult) return 'Teams ready — tap "Go again" to reset';
    if (countdown !== null && countdown > 0) return 'Hold still…';
    if (touches.length === 0) {
      return `Place at least ${MIN_TOUCHES} fingers on the screen`;
    }
    if (touches.length < MIN_TOUCHES) {
      return `${touches.length} of ${MIN_TOUCHES} fingers — keep going`;
    }
    return `${touches.length} fingers down`;
  }, [activeTab, countdown, showingResult, teams.length, touches.length]);

  const namesForm = (
    <NamesRandomizer
      players={players}
      teams={teams}
      draws={draws}
      showTouchHint={isTouchDevice !== true}
      onAdd={(name) => changePlayers([...players, name])}
      onRemove={(index) => changePlayers(players.filter((_, i) => i !== index))}
      onGenerate={generateTeams}
    />
  );

  if (isTouchDevice !== true) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Eyebrow>2v2 · Random draw</Eyebrow>
          <PageTitle>Random teams</PageTitle>
        </div>
        {namesForm}
      </div>
    );
  }

  return (
    // Fills the space between the phone header and bottom bar, or beside the
    // desktop sidebar.
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+var(--header-height))] bottom-[calc(env(safe-area-inset-bottom)+64px)] z-20 flex flex-col bg-background lg:top-0 lg:bottom-0 lg:left-60">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h1 className="text-lg leading-tight font-bold">Random Teams</h1>
          <p className="line-clamp-2 min-h-[2lh] text-xs leading-snug text-muted-foreground">
            {headerSubtitle}
          </p>
        </div>
        <RandomizerTabs activeTab={activeTab} onSelect={selectTab} />
      </header>

      {activeTab === 'touch' ? (
        <TouchRandomizerSurface
          surfaceRef={surfaceRef}
          touches={touches}
          countdown={countdown}
          showingResult={showingResult}
          onGoAgain={resetTouchRandomizer}
        />
      ) : (
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto bg-background p-4">
          {namesForm}
        </div>
      )}
    </div>
  );
}

function RandomizerTabs({
  activeTab,
  onSelect,
}: {
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
}) {
  const tab = (value: Tab, label: string, Icon: typeof Hand) => (
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === value}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        activeTab === value
          ? 'bg-muted font-semibold text-foreground'
          : 'text-muted-foreground'
      )}
      onClick={() => onSelect(value)}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  );
  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-full border bg-card p-1 text-xs"
      role="tablist"
      aria-label="Randomizer mode"
    >
      {tab('touch', 'Touch', Hand)}
      {tab('names', 'Names', Keyboard)}
    </div>
  );
}

function NamesRandomizer({
  players,
  teams,
  draws,
  showTouchHint,
  onAdd,
  onRemove,
  onGenerate,
}: {
  players: string[];
  teams: string[][];
  draws: number;
  showTouchHint: boolean;
  onAdd: (name: string) => void;
  onRemove: (index: number) => void;
  onGenerate: () => void;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const full = players.length >= PLAYER_COUNT;
  const missing = PLAYER_COUNT - players.length;
  const drawn = teams.length === 2;

  const add = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name || full) return;
    if (players.some((p) => p.toLowerCase() === name.toLowerCase())) return;
    onAdd(name);
    setDraft('');
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <section
        aria-labelledby="random-players-heading"
        className="flex flex-col gap-4 lg:rounded-xl lg:border lg:bg-card lg:p-5"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="random-players-heading"
              className="text-3xl font-bold tracking-tight lg:text-xl lg:font-normal lg:tracking-normal"
            >
              Who&apos;s playing?
            </h2>
            <span className="text-sm font-bold tabular-nums">
              {players.length}/{PLAYER_COUNT}
            </span>
          </div>
          <p className="text-sm text-muted-foreground lg:hidden">
            Add {PLAYER_COUNT} players and let fate pick the sides.
          </p>
        </div>

        {players.length > 0 ? (
          <ul
            aria-label="Players"
            className="grid grid-cols-2 gap-2 lg:grid-cols-1"
          >
            {players.map((name, index) => (
              <li
                key={`${name}-${index}`}
                className="flex min-w-0 items-center gap-2.5 rounded-lg border bg-background py-1.5 pr-1.5 pl-2.5"
              >
                <PlayerAvatar name={name} className="size-8 text-[10px]" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-my-1.5 size-11 shrink-0 text-muted-foreground"
                  aria-label={`Remove ${name}`}
                  onClick={() => {
                    onRemove(index);
                    inputRef.current?.focus();
                  }}
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <form onSubmit={add} className="flex gap-2">
          <Input
            ref={inputRef}
            aria-label="Add a player by name"
            placeholder={full ? 'All players added' : 'Add a player by name'}
            value={draft}
            disabled={full}
            autoComplete="off"
            enterKeyHint="done"
            className="h-11"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Add player"
            disabled={full || draft.trim() === ''}
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </form>
      </section>

      <section
        aria-labelledby="random-draw-heading"
        className="flex flex-col gap-4"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="random-draw-heading" className="text-2xl">
            The draw
          </h2>
          {draws > 0 ? (
            <span className="text-xs text-muted-foreground">Draw #{draws}</span>
          ) : null}
        </div>

        {drawn ? (
          <div
            aria-live="polite"
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2"
          >
            <TeamCard label="Team 1" names={teams[0]} highlight />
            <span className="self-center text-xs text-muted-foreground">
              vs
            </span>
            <TeamCard label="Team 2" names={teams[1]} align="end" />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground lg:py-14">
            {full
              ? 'Everyone is in. Draw the teams.'
              : `Add ${missing} more ${missing === 1 ? 'player' : 'players'} to draw teams.`}
          </p>
        )}

        <Button
          type="button"
          className="h-12 gap-2 text-base font-bold"
          disabled={!full}
          onClick={onGenerate}
        >
          <Shuffle aria-hidden="true" />
          {drawn ? 'Shuffle again' : 'Draw teams'}
        </Button>

        {showTouchHint ? (
          <div className="hidden items-center gap-4 rounded-xl border border-dashed p-4 lg:flex">
            <span
              aria-hidden="true"
              className="grid shrink-0 grid-cols-2 gap-1"
            >
              <span className="size-4 rounded-full bg-primary" />
              <span className="size-4 rounded-full bg-foreground" />
              <span className="size-4 rounded-full bg-foreground" />
              <span className="size-4 rounded-full bg-primary" />
            </span>
            <p className="text-sm">
              <span className="font-semibold">Standing at the table?</span>
              <br />
              <span className="text-muted-foreground">
                Open Random teams on a phone and use the Touch draw.
              </span>
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function TeamCard({
  label,
  names,
  highlight = false,
  align = 'start',
}: {
  label: string;
  names: string[];
  highlight?: boolean;
  align?: 'start' | 'end';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border p-4 lg:p-6',
        highlight ? 'border-primary/50 bg-primary/10' : 'bg-card',
        align === 'end' && 'items-end text-right'
      )}
    >
      <h3
        className={cn(
          'text-[10px] font-semibold tracking-[0.14em] uppercase',
          highlight ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {label}
      </h3>
      <ul className="flex w-full flex-col gap-1">
        {names.map((name, index) => (
          <li key={index} className="truncate text-xl font-bold lg:text-3xl">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TouchRandomizerSurface({
  surfaceRef,
  touches,
  countdown,
  showingResult,
  onGoAgain,
}: {
  surfaceRef: RefObject<HTMLDivElement | null>;
  touches: TouchMarker[];
  countdown: number | null;
  showingResult: boolean;
  onGoAgain: () => void;
}) {
  const isCountingDown = countdown !== null && countdown > 0;

  // From lg the sidebar stays beside the surface, and a pull that starts there
  // would still reload the page mid-draw.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-no-pull-to-refresh', '');
    return () => root.removeAttribute('data-no-pull-to-refresh');
  }, []);

  return (
    <div
      ref={surfaceRef}
      role="application"
      aria-label="Touch randomizer surface"
      className="relative flex-1 touch-none overflow-hidden bg-muted select-none"
      // The app-shell pull-to-refresh listens on `window` with `{ passive:
      // true }`, so this page's own preventDefault() cannot suppress it. The
      // shared component bails via `closest('[data-no-pull-to-refresh]')`,
      // which also covers every descendant of this surface.
      data-no-pull-to-refresh=""
    >
      {touches.length === 0 && !showingResult ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-primary/40 bg-background/60">
            <Hand className="h-10 w-10 text-primary" />
          </div>
          <p className="text-2xl font-bold">Place your fingers</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            At least {MIN_TOUCHES}. After a {COUNTDOWN_SECONDS}-second
            countdown, two random fingers become{' '}
            <span className="font-semibold text-foreground">white team</span>{' '}
            and two become{' '}
            <span className="font-semibold text-foreground">red team</span>.
          </p>
        </div>
      ) : null}

      {isCountingDown ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="animate-pulse text-[12rem] leading-none font-bold text-primary/80">
            {countdown}
          </div>
        </div>
      ) : null}

      {showingResult ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2 px-6 text-center">
          <p className="text-sm tracking-widest text-muted-foreground uppercase">
            Teams
          </p>
          <div className="flex items-center gap-3 text-2xl font-bold">
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-foreground bg-white" />
              White
            </span>
            <span className="text-muted-foreground">vs</span>
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-full bg-red-600" />
              Red
            </span>
          </div>
        </div>
      ) : null}

      {showingResult ? <TeamConnectorSvg touches={touches} /> : null}

      {touches.map((touch) =>
        showingResult && touch.color === null ? null : (
          <div
            key={touch.identifier}
            className={cn(
              'pointer-events-none absolute flex h-28 w-28 items-center justify-center rounded-full border-4 shadow-lg transition-colors duration-500',
              isCountingDown && 'pulse-scale',
              touch.color === 'white' && 'border-white',
              touch.color === 'red' && 'border-red-600',
              touch.color === null && 'border-primary'
            )}
            style={{
              left: `${touch.x}px`,
              top: `${touch.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className={cn(
                'rounded-full transition-colors duration-500',
                touch.color === 'white' && 'bg-white',
                touch.color === 'red' && 'bg-red-600',
                touch.color === null && 'bg-primary opacity-30'
              )}
              style={{ width: '88px', height: '88px' }}
            />
          </div>
        )
      )}

      {showingResult ? (
        <button
          type="button"
          className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary-fill px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg"
          onClick={onGoAgain}
        >
          <RotateCcw className="h-4 w-4" />
          Go again
        </button>
      ) : null}
    </div>
  );
}

function TeamConnectorSvg({ touches }: { touches: TouchMarker[] }) {
  const white = touches.filter((touch) => touch.color === 'white');
  const red = touches.filter((touch) => touch.color === 'red');

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
      aria-hidden="true"
    >
      {white.length === 2 ? (
        <line
          x1={white[0].x}
          y1={white[0].y}
          x2={white[1].x}
          y2={white[1].y}
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="14 10"
        />
      ) : null}
      {red.length === 2 ? (
        <line
          x1={red[0].x}
          y1={red[0].y}
          x2={red[1].x}
          y2={red[1].y}
          stroke="#dc2626"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="14 10"
        />
      ) : null}
    </svg>
  );
}
