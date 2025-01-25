<script lang="ts">
  import { Check, X } from 'lucide-svelte';
  import Button from '../ui/button/button.svelte';
  import GaugeCountdown from './gauge-countdown.svelte';
  import LargeQueueModal from './large-queue-modal.svelte';
  import type { MatchMakingStatePendingMatch } from './types';

  export let matchMakingState: MatchMakingStatePendingMatch;
  export let onAcceptMatch: () => void;
  export let onDeclineMatch: () => void;
</script>

<LargeQueueModal>
  <div class="flex h-full flex-col items-stretch justify-between">
    <p class="self-center text-3xl font-bold">
      {#if matchMakingState.hasBeenAccepted}Match accepted!{:else}Match found!{/if}
    </p>
    <GaugeCountdown toDate={matchMakingState.expiresAt} />
    <p class="self-center text-lg text-gray-400">
      {#if matchMakingState.hasBeenAccepted}
        Waiting for other players to accept the match
      {:else}
        Accept or decline the match before time runs out
      {/if}
    </p>
    {#if matchMakingState.hasBeenAccepted}
      <Button class="self-center px-8 py-6 text-lg" disabled>
        Match accepted
      </Button>
    {:else}
      <div class="flex justify-stretch gap-2 sm:gap-4">
        <Button
          on:click={onDeclineMatch}
          variant="secondary"
          class="flex-1 gap-1 text-lg sm:gap-3"><X />Decline</Button
        >
        <Button on:click={onAcceptMatch} class="flex-1 gap-1 text-lg sm:gap-3"
          ><Check /> Accept</Button
        >
      </div>
    {/if}
  </div>
</LargeQueueModal>
