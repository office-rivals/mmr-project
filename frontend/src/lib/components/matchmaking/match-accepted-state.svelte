<script lang="ts">
  import Button from '../ui/button/button.svelte';
  import GaugeCountdown from './gauge-countdown.svelte';
  import LargeQueueModal from './large-queue-modal.svelte';
  import type { MatchMakingStateMatchAccepted } from './types';

  export let matchMakingState: MatchMakingStateMatchAccepted;
</script>

<LargeQueueModal>
  <div class="flex h-full flex-col items-stretch justify-between">
    <p class="self-center text-3xl font-bold">Match accepted!</p>
    <GaugeCountdown toDate={matchMakingState.expiresAt} />
    <p class="self-center text-lg text-gray-400">
      Waiting for other players to accept the match
    </p>
    <Button class="self-center px-8 py-6 text-lg" disabled>
      Match accepted
    </Button>
  </div>
</LargeQueueModal>
