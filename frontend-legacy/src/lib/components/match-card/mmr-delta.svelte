<script lang="ts">
  interface Props {
    delta?: number | undefined | null;
  }

  let { delta = null }: Props = $props();
</script>

{#if delta != null}
  <span
    class="text-xs"
    class:positive={delta >= 0}
    class:destructive={delta < 0}
  >
    ({delta > 0 ? '+' : ''}{delta})</span
  >
{/if}
