import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { meQueryKey } from '@/lib/shell';
import { cn } from '@/lib/utils';

const THRESHOLD = 80; // px of damped pull required to commit a refresh
const MAX_PULL = 120; // damped pull is clamped here
const DAMPING = 0.4;
const ERROR_DISPLAY_MS = 1500;

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

  // Window listeners are registered once, so their mutable state lives in refs.
  const startY = useRef(0);
  const isPulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    // The feature is PWA-only; outside standalone mode attach nothing so
    // ordinary browser users pay no touch-listener cost. Standalone status is
    // fixed for the session, so it's resolved once here, not per gesture.
    if (!isStandaloneMode()) return;

    const setPull = (next: number) => {
      pullDistanceRef.current = next;
      setPullDistance(next);
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
      // Single-finger pull, at the very top, while idle. Bail on surfaces that
      // own their own touch gestures (e.g. the /random touch randomizer).
      if (
        isRefreshingRef.current ||
        window.scrollY !== 0 ||
        e.touches.length !== 1
      )
        return;
      if ((e.target as Element | null)?.closest('[data-no-pull-to-refresh]'))
        return;
      startY.current = e.touches[0].clientY;
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
      setPull(Math.min(deltaY * DAMPING, MAX_PULL));
    };

    const onTouchEnd = async (e: TouchEvent) => {
      // Commit only once the last finger lifts, so a multi-finger gesture
      // can't fire the refresh early.
      if (!isPulling.current || e.touches.length > 0) return;
      isPulling.current = false;

      if (pullDistanceRef.current < THRESHOLD) {
        setPull(0);
        return;
      }

      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        // Inactive loader queries must refetch too, and a failed request must
        // reject so the gesture can show its failure state.
        await queryClientRef.current.refetchQueries(
          {
            type: 'all',
            predicate: (query) =>
              query.queryKey.length !== meQueryKey.length ||
              query.queryKey[0] !== meQueryKey[0],
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
        // Don't reset as if it succeeded — surface a brief error state.
        console.error('Pull-to-refresh failed', err);
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
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = null;
    };
  }, []);

  if (pullDistance <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-0 right-0 z-20 flex justify-center"
      style={{
        top: `calc(env(safe-area-inset-top) + var(--header-height) + ${pullDistance - 40}px)`,
        opacity: Math.min(pullDistance / THRESHOLD, 1),
      }}
    >
      <div className="rounded-full border bg-card p-2 shadow-md">
        <RefreshCw
          className={cn(
            'h-6 w-6',
            refreshFailed ? 'text-destructive' : 'text-primary',
            isRefreshing && 'animate-spin'
          )}
          style={{
            transform: `rotate(${(pullDistance / THRESHOLD) * 360}deg)`,
          }}
        />
      </div>
      <span className="sr-only">
        {refreshFailed ? 'Refresh failed' : isRefreshing ? 'Refreshing' : ''}
      </span>
    </div>
  );
}
