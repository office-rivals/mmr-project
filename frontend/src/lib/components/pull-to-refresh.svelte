<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { RefreshCw } from 'lucide-svelte';

  const THRESHOLD = 80;
  const MAX_PULL = 120;
  const DAMPING = 0.4;

  let pullDistance = $state(0);
  let isRefreshing = $state(false);
  let startY = $state(0);
  let isPulling = $state(false);

  function isStandaloneMode(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  }

  function onTouchStart(e: TouchEvent) {
    if (window.scrollY !== 0 || isRefreshing || !isStandaloneMode()) return;
    startY = e.touches[0].clientY;
    isPulling = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!isPulling) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY < 0) {
      pullDistance = 0;
      return;
    }
    pullDistance = Math.min(deltaY * DAMPING, MAX_PULL);
  }

  async function onTouchEnd() {
    if (!isPulling) return;
    isPulling = false;

    if (pullDistance >= THRESHOLD) {
      isRefreshing = true;
      pullDistance = THRESHOLD;
      try {
        await invalidateAll();
      } finally {
        isRefreshing = false;
        pullDistance = 0;
      }
    } else {
      pullDistance = 0;
    }
  }
</script>

<svelte:window
  on:touchstart={onTouchStart}
  on:touchmove={onTouchMove}
  on:touchend={onTouchEnd}
/>

{#if pullDistance > 0}
  <div
    class="pointer-events-none fixed left-0 right-0 z-50 flex justify-center"
    style="top: calc(env(safe-area-inset-top) + {pullDistance -
      40}px); opacity: {Math.min(pullDistance / THRESHOLD, 1)}"
  >
    <div class="rounded-full border bg-card p-2 shadow-md">
      <RefreshCw
        class="h-6 w-6 text-primary {isRefreshing ? 'animate-spin' : ''}"
        style="transform: rotate({(pullDistance / THRESHOLD) * 360}deg)"
      />
    </div>
  </div>
{/if}
