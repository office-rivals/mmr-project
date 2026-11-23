import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isRedirect, useRouter } from '@tanstack/react-router';
import {
  meQueryKey,
  refreshAuthedShellData,
  requireSuccessfulShellRefresh,
} from '@/lib/shell';
import { cn } from '@/lib/utils';

const THRESHOLD = 80; // px of damped pull required to commit a refresh
const MAX_PULL = 120; // damped pull is clamped here
const DAMPING = 0.4;
const HOLD = 56; // where the content rests while the refresh runs
const ERROR_DISPLAY_MS = 1500;
const SETTLE_MS = 220; // matches the #content transition in app.css

function isStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** PWA-only pull-to-refresh, mounted once by the authed layout. */
export function PullToRefresh() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const startY = useRef(0);
  const isPulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    // Standalone status cannot change during this mount.
    if (!isStandaloneMode()) return;

    // The page follows the finger: app.css moves #content by --pull-offset,
    // tracking the touch while dragging and easing everywhere else.
    const root = document.documentElement;
    // A refresh still in flight when the layout unmounts must not move the
    // next mount's content.
    let disposed = false;
    const clearContentOffset = () => {
      delete root.dataset.pull;
      root.style.removeProperty('--pull-offset');
    };
    const setPull = (next: number, dragging = false) => {
      if (disposed) return;
      pullDistanceRef.current = next;
      setPullDistance(next);
      // A tap that never moved the page leaves it alone.
      if (next === 0 && root.dataset.pull === undefined) return;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = null;
      root.style.setProperty('--pull-offset', `${next}px`);
      root.dataset.pull = dragging && next > 0 ? 'drag' : 'settle';
      if (next === 0)
        settleTimer.current = setTimeout(clearContentOffset, SETTLE_MS);
    };
    const setRefreshing = (next: boolean) => {
      isRefreshingRef.current = next;
      setIsRefreshing(next);
    };

    const resetPull = () => {
      isPulling.current = false;
      if (!isRefreshingRef.current) setPull(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (
        isRefreshingRef.current ||
        window.scrollY !== 0 ||
        e.touches.length !== 1
      )
        return;
      if ((e.target as Element | null)?.closest('[data-no-pull-to-refresh]'))
        return;
      // A retry while the last failure is still showing replaces it, so the
      // old timer cannot put the page back mid-pull.
      if (errorTimer.current) {
        clearTimeout(errorTimer.current);
        errorTimer.current = null;
        setRefreshFailed(false);
      }
      // Caught while easing back: hold the page where it is on screen.
      const content = document.getElementById('content');
      if (root.dataset.pull === 'settle' && content)
        setPull(parseFloat(getComputedStyle(content).top) || 0, true);
      // Picks up from where the page rests, so a retry does not jump.
      startY.current = e.touches[0].clientY - pullDistanceRef.current / DAMPING;
      isPulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaY = touch.clientY - startY.current;
      if (deltaY < 0) {
        setPull(0);
        return;
      }
      const next = Math.min(deltaY * DAMPING, MAX_PULL);
      if (pullDistanceRef.current < THRESHOLD && next >= THRESHOLD)
        navigator.vibrate?.(10);
      setPull(next, true);
    };

    const onTouchEnd = async (e: TouchEvent) => {
      if (!isPulling.current || e.touches.length > 0) return;
      isPulling.current = false;

      if (pullDistanceRef.current < THRESHOLD) {
        setPull(0);
        return;
      }

      setRefreshing(true);
      setPull(HOLD);
      try {
        await refreshAuthedShellData(queryClientRef.current);
        requireSuccessfulShellRefresh(queryClientRef.current);
        // SSR-only cache entries have no client function; route loaders refresh them.
        await queryClientRef.current.refetchQueries(
          {
            type: 'all',
            predicate: (query) =>
              (query.queryKey.length !== meQueryKey.length ||
                query.queryKey[0] !== meQueryKey[0]) &&
              typeof query.options.queryFn === 'function',
          },
          { throwOnError: true }
        );
        await routerRef.current.invalidate({ sync: true });
        const failedMatch = routerRef.current.state.matches.find(
          (match) => match.status === 'error'
        );
        if (failedMatch) throw failedMatch.error;
        setRefreshing(false);
        setPull(0);
      } catch (err) {
        if (isRedirect(err)) {
          setRefreshing(false);
          setPull(0);
          err.options._fromLocation = routerRef.current.stores.location.get();
          await routerRef.current.navigate(
            routerRef.current.resolveRedirect(err).options
          );
          return;
        }

        console.error('Pull-to-refresh failed', err);
        if (disposed) return;
        setRefreshing(false);
        setRefreshFailed(true);
        errorTimer.current = setTimeout(() => {
          setRefreshFailed(false);
          setPull(0);
        }, ERROR_DISPLAY_MS);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', resetPull);
    return () => {
      disposed = true;
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = null;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = null;
      clearContentOffset();
    };
  }, []);

  if (pullDistance <= 0) return null;

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const armed = progress === 1;
  const label = refreshFailed
    ? 'Refresh failed'
    : isRefreshing
      ? 'Refreshing'
      : armed
        ? 'Release to refresh'
        : 'Pull to refresh';

  return (
    // Fills the gap the content leaves under the header.
    <div
      role="status"
      aria-live="polite"
      // From `lg` the header is a sidebar, so the gap opens at the top.
      className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+var(--header-height))] right-0 left-0 z-20 flex items-center justify-center gap-2 overflow-hidden text-xs font-medium lg:top-[env(safe-area-inset-top)] lg:left-60"
      style={{ height: pullDistance }}
    >
      <PullRing
        progress={progress}
        spinning={isRefreshing}
        failed={refreshFailed}
      />
      <span
        className={cn(
          // `text-destructive` is too dark for small text on this background.
          refreshFailed
            ? 'text-red-400'
            : armed || isRefreshing
              ? 'text-foreground'
              : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}

const RING_RADIUS = 8;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Fills as the pull nears the threshold, then spins while refreshing. */
function PullRing({
  progress,
  spinning,
  failed,
}: {
  progress: number;
  spinning: boolean;
  failed: boolean;
}) {
  const filled = spinning ? 0.25 : progress;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={cn(
        'size-5 -rotate-90',
        spinning && 'animate-spin',
        failed ? 'text-destructive' : 'text-primary'
      )}
    >
      <circle
        cx="10"
        cy="10"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="2"
        className="stroke-muted"
      />
      <circle
        cx="10"
        cy="10"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        stroke="currentColor"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={RING_LENGTH * (1 - (failed ? 1 : filled))}
      />
    </svg>
  );
}
