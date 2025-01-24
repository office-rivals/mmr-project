<script lang="ts">
  import { onMount } from 'svelte';

  export let toDate: Date;

  const initialSecondsToRespond = Math.ceil(
    (toDate.getTime() - Date.now()) / 1000
  );
  let secondsToRespond = Math.ceil((toDate.getTime() - Date.now()) / 1000);
  onMount(() => {
    let frame: number;
    const updateSecondsToRespond = () => {
      secondsToRespond = Math.ceil((toDate.getTime() - Date.now()) / 1000);
      frame = requestAnimationFrame(updateSecondsToRespond);
    };
    frame = requestAnimationFrame(updateSecondsToRespond);
    return () => {
      cancelAnimationFrame(frame);
    };
  });
</script>

{#if initialSecondsToRespond !== null}
  <div class="relative h-44 w-44 self-center">
    <svg viewBox="0 0 100 100" class="h-full w-full rotate-[135deg] transform">
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke-width="6"
        stroke-linecap="round"
        stroke-dasharray="188.5 251.3"
        class="stroke-muted"
      />

      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke-width="6"
        stroke-linecap="round"
        style="animation-duration: {initialSecondsToRespond}s"
        class="animate-[progress_0s_linear_forwards] stroke-white"
      />
    </svg>
    <div
      class="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-4"
    >
      <span class="text-3xl font-bold text-white"
        >{Math.max(secondsToRespond, 0)}</span
      >
    </div>
  </div>
{/if}
