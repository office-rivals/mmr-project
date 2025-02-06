<script lang="ts">
  import { Pause } from 'lucide-svelte';
  import Button from '../ui/button/button.svelte';
  import type { MatchMakingStateQueued } from './types';

  interface Props {
    matchMakingState: MatchMakingStateQueued;
    onLeaveQueue: () => void;
  }

  let { matchMakingState, onLeaveQueue }: Props = $props();
</script>

<div class="fixed bottom-20 left-0 right-0 mx-auto max-w-screen-sm px-4">
  <div
    class="animate-border w-full rounded-2xl border border border-transparent p-5 [background:linear-gradient(60deg,#001003,theme(colors.orange.950)_60%,#001003)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.orange.600/.58)_80%,_theme(colors.orange.300)_94%,_theme(colors.orange.600/.58))_border-box]"
  >
    <div class="flex items-center justify-between">
      <div>
        <span class="text-xs">Matchmaking</span>
        <p>Looking for other players...</p>
      </div>
      <div class="flex items-center gap-4">
        <p class="text-sm">{matchMakingState.playersInQueue} / 4</p>
        <Button variant="destructive" type="submit" onclick={onLeaveQueue}
          ><Pause class="mr-2" />Leave</Button
        >
      </div>
    </div>
  </div>
</div>

<style>
  @property --border-angle {
    inherits: false;
    initial-value: 0deg;
    syntax: '<angle>';
  }
</style>
