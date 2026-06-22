<script lang="ts">
  import { RECENT_FORM_LENGTH } from '$lib/constants';

  interface Props {
    results: boolean[];
  }

  let { results }: Props = $props();
</script>

<div class="flex gap-1" aria-label="Recent form">
  {#each Array(RECENT_FORM_LENGTH) as _, i}
    {@const isPresent = i < results.length}
    {@const isWin = isPresent && results[i]}
    <span
      class="inline-block h-2.5 w-2.5 rounded-full border border-border
             {isPresent
        ? isWin
          ? 'bg-emerald-500'
          : 'bg-rose-500'
        : 'bg-transparent'}"
      title={isPresent ? (isWin ? 'Win' : 'Loss') : 'No result'}
    ></span>
  {/each}
</div>
