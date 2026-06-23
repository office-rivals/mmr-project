<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { RefreshCw } from 'lucide-svelte';

  const THRESHOLD = 80;
  const MAX_PULL = 120;
  const DAMPING = 0.4;
  const ERROR_DISPLAY_MS = 1500;

  // Only these drive the UI; startY/isPulling are gesture-internal, so plain
  // `let` is enough (no need for $state reactivity).
  let pullDistance = $state(0);
  let isRefreshing = $state(false);
  let refreshFailed = $state(false);
  let startY = 0;
  let isPulling = false;

  function isStandaloneMode(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  function resetPull() {
    isPulling = false;
    if (!isRefreshing) pullDistance = 0;
  }

  function onTouchStart(e: TouchEvent) {
    // Single-finger pull, at the very top, while idle. Bail on surfaces that
    // own their own touch gestures (e.g. the /random touch randomizer).
    if (isRefreshing || window.scrollY !== 0 || e.touches.length !== 1) return;
    if ((e.target as Element | null)?.closest('[data-no-pull-to-refresh]'))
      return;
    startY = e.touches[0].clientY;
    isPulling = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!isPulling) return;
    const touch = e.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - startY;
    if (deltaY < 0) {
      pullDistance = 0;
      return;
    }
    pullDistance = Math.min(deltaY * DAMPING, MAX_PULL);
  }

  async function onTouchEnd(e: TouchEvent) {
    // Commit only once the last finger lifts, so a multi-finger gesture can't
    // fire the refresh early.
    if (!isPulling || e.touches.length > 0) return;
    isPulling = false;

    if (pullDistance < THRESHOLD) {
      pullDistance = 0;
      return;
    }

    isRefreshing = true;
    pullDistance = THRESHOLD;
    try {
      await invalidateAll();
      isRefreshing = false;
      pullDistance = 0;
    } catch (err) {
      // Don't reset as if it succeeded — surface a brief error state.
      console.error('Pull-to-refresh failed', err);
      isRefreshing = false;
      refreshFailed = true;
      setTimeout(() => {
        refreshFailed = false;
        pullDistance = 0;
      }, ERROR_DISPLAY_MS);
    }
  }

  onMount(() => {
    // The feature is PWA-only; outside standalone mode attach nothing so
    // ordinary browser users pay no touch-listener cost. Standalone status is
    // fixed for the session, so it's resolved once here, not per gesture.
    if (!isStandaloneMode()) return;
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', resetPull);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
    };
  });
</script>

{#if pullDistance > 0}
  <div
    role="status"
    aria-live="polite"
    class="pointer-events-none fixed left-0 right-0 z-20 flex justify-center"
    style="top: calc(env(safe-area-inset-top) + var(--header-height) + {pullDistance -
      40}px); opacity: {Math.min(pullDistance / THRESHOLD, 1)}"
  >
    <div class="rounded-full border bg-card p-2 shadow-md">
      <RefreshCw
        class="h-6 w-6 {refreshFailed
          ? 'text-destructive'
          : 'text-primary'} {isRefreshing ? 'animate-spin' : ''}"
        style="transform: rotate({(pullDistance / THRESHOLD) * 360}deg)"
      />
    </div>
    <span class="sr-only">
      {refreshFailed ? 'Refresh failed' : isRefreshing ? 'Refreshing' : ''}
    </span>
  </div>
{/if}
