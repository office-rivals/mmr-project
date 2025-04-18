<script lang="ts">
  import type { ActiveMatchDto, UserDetails } from '$api';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { CircleOff, Send } from 'lucide-svelte';
  import ActiveMatchCard from './active-match-card.svelte';

  interface Props {
    activeMatches: ActiveMatchDto[];
    users: UserDetails[];
    currentPlayerId: number | null | undefined;
  }

  let { activeMatches, users, currentPlayerId }: Props = $props();

  let isCancellingMatch = $state(false);

  let currentActiveMatch = $derived(
    currentPlayerId != null
      ? (activeMatches?.find((match) => {
          return (
            match.team1.playerIds.includes(currentPlayerId) ||
            match.team2.playerIds.includes(currentPlayerId)
          );
        }) ?? null)
      : null
  );

  const onCancelMatch = async (matchId: string) => {
    const body = new FormData();
    body.append('intent', 'cancel');
    body.append('matchId', matchId);
    await fetch('/api/active-matches', { method: 'POST', body });
  };
</script>

{#if currentActiveMatch != null && currentPlayerId != null}
  <div class="flex flex-col gap-4">
    <h2 class="text-2xl md:text-4xl">Active Match</h2>
    <div class="flex flex-col gap-2">
      <ActiveMatchCard users={users ?? []} match={currentActiveMatch} />
      <div class="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onclick={() => {
            isCancellingMatch = true;
          }}
        >
          <CircleOff class="mr-2 h-4 w-4" />Cancel match
        </Button>
        <Button
          variant="default"
          href={`/active-match/${currentActiveMatch.id}`}
        >
          <Send class="mr-2 h-4 w-4" />Submit
        </Button>
      </div>
    </div>
    <hr class="border-muted" />
  </div>
  {#if isCancellingMatch}
    <Dialog.Root
      open
      onOpenChange={() => {
        isCancellingMatch = false;
      }}
    >
      <Dialog.Content>
        <Dialog.Title>Are you sure?</Dialog.Title>
        <Dialog.Description
          >This will cancel the match and cannot be undone.</Dialog.Description
        >
        <div class="flex gap-2">
          <Button
            type="button"
            class="flex-1"
            variant="secondary"
            onclick={() => {
              isCancellingMatch = false;
            }}
          >
            Keep match
          </Button>
          <Button
            type="button"
            class="flex-1"
            variant="destructive"
            onclick={() => {
              isCancellingMatch = false;
              onCancelMatch(currentActiveMatch.id);
            }}
          >
            Cancel match
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  {/if}
{/if}
