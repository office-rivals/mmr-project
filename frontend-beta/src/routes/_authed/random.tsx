import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Hand, Keyboard, RotateCcw } from 'lucide-react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getRandomTeamsSessionStorageKey } from '@/lib/util/session';
import { cn } from '@/lib/utils';

const MIN_TOUCHES = 4;
const COUNTDOWN_SECONDS = 3;
const TEAM_SIZE = 2;

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
  }, [
    active,
    clearTimer,
    publishCountdown,
    publishTouches,
    restartCountdown,
  ]);

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

  const [players, setPlayers] = useState<string[]>(() => [
    player[0] ?? '',
    player[1] ?? '',
    player[2] ?? '',
    player[3] ?? '',
  ]);
  const [teams, setTeams] = useState<string[][]>([]);

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

  function generateTeams() {
    const shuffled = fisherYatesShuffle(players);
    const next = [
      shuffled.slice(0, TEAM_SIZE),
      shuffled.slice(TEAM_SIZE, TEAM_SIZE * 2),
    ];
    setTeams(next);
    // Keyed on the current input values, not the URL params, and no URL update.
    sessionStorage.setItem(
      getRandomTeamsSessionStorageKey(players),
      JSON.stringify(next)
    );
  }

  const allPlayersFilled = !players.some((p) => p == null || p.trim() === '');

  const headerSubtitle = useMemo(() => {
    if (activeTab === 'names') {
      return teams.length === 2
        ? 'Tap generate again to reshuffle.'
        : 'Type four names and tap generate.';
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
      allPlayersFilled={allPlayersFilled}
      onChangePlayer={(index, value) =>
        setPlayers((current) =>
          current.map((p, i) => (i === index ? value : p))
        )
      }
      onGenerate={generateTeams}
    />
  );

  if (isTouchDevice !== true) {
    return (
      <div className="flex flex-col gap-8">
        <PageTitle>Random Team Generator</PageTitle>
        {namesForm}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 z-20 flex flex-col bg-background"
      style={{
        top: 'calc(env(safe-area-inset-top) + var(--header-height))',
        bottom: 'calc(env(safe-area-inset-bottom) + 64px)',
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h1 className="text-lg font-bold leading-tight">Random Teams</h1>
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
  return (
    <div
      className="flex items-center gap-1 rounded-full border bg-muted p-1 text-xs"
      role="tablist"
      aria-label="Randomizer mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'touch'}
        className={cn(
          'flex items-center gap-1 rounded-full px-3 py-1 transition-colors',
          activeTab === 'touch'
            ? 'bg-background font-semibold shadow-sm'
            : 'text-muted-foreground'
        )}
        onClick={() => onSelect('touch')}
      >
        <Hand className="h-3.5 w-3.5" />
        Touch
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'names'}
        className={cn(
          'flex items-center gap-1 rounded-full px-3 py-1 transition-colors',
          activeTab === 'names'
            ? 'bg-background font-semibold shadow-sm'
            : 'text-muted-foreground'
        )}
        onClick={() => onSelect('names')}
      >
        <Keyboard className="h-3.5 w-3.5" />
        Names
      </button>
    </div>
  );
}

function NamesRandomizer({
  players,
  teams,
  allPlayersFilled,
  onChangePlayer,
  onGenerate,
}: {
  players: string[];
  teams: string[][];
  allPlayersFilled: boolean;
  onChangePlayer: (index: number, value: string) => void;
  onGenerate: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {players.map((value, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Label htmlFor={`player-${index}`}>{`Player ${index + 1}`}</Label>
            <Input
              id={`player-${index}`}
              value={value}
              onChange={(event) => onChangePlayer(index, event.target.value)}
            />
          </div>
        ))}
      </div>
      <Button type="button" disabled={!allPlayersFilled} onClick={onGenerate}>
        Generate Teams
      </Button>
      {teams.length === 2 ? (
        <div className="flex flex-row gap-4 text-center">
          <div className="flex flex-1 flex-col">
            <h3 className="text-2xl">Team 1</h3>
            <ul>
              {teams[0].map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          </div>
          <div className="min-h-full w-px self-stretch bg-border" />
          <div className="flex flex-1 flex-col">
            <h3 className="text-2xl">Team 2</h3>
            <ul>
              {teams[1].map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
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

  return (
    <div
      ref={surfaceRef}
      role="application"
      aria-label="Touch randomizer surface"
      className="relative flex-1 touch-none select-none overflow-hidden bg-muted"
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
            At least {MIN_TOUCHES}. After a {COUNTDOWN_SECONDS}-second countdown,
            two random fingers become{' '}
            <span className="font-semibold text-foreground">white team</span> and
            two become{' '}
            <span className="font-semibold text-foreground">red team</span>.
          </p>
        </div>
      ) : null}

      {isCountingDown ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="animate-pulse text-[12rem] font-bold leading-none text-primary/80">
            {countdown}
          </div>
        </div>
      ) : null}

      {showingResult ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2 px-6 text-center">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
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
          className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg"
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
