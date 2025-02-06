<script lang="ts">
  import ActiveMatchCard from '../../../routes/(authed)/components/active-match-card.svelte';
  import Button from '../ui/button/button.svelte';
  import LargeQueueModal from './large-queue-modal.svelte';
  import type { MatchMakingStateActiveMatch } from './types';

  interface Props {
    matchMakingState: MatchMakingStateActiveMatch;
    onConfirmedMatch: () => void;
  }

  let { matchMakingState, onConfirmedMatch }: Props = $props();
</script>

<LargeQueueModal>
  <div class="flex h-full flex-col items-stretch justify-between">
    <p class="self-center text-3xl font-bold">Match ready!</p>
    <ActiveMatchCard
      match={matchMakingState.activeMatch}
      users={matchMakingState.activeMatch.users}
    />
    <p class="self-center text-lg text-gray-400">
      Now the teams are set. Go play!
    </p>
    <Button
      type="button"
      onclick={onConfirmedMatch}
      class="self-center px-8 py-6 text-lg">OK!</Button
    >
  </div>
</LargeQueueModal>
