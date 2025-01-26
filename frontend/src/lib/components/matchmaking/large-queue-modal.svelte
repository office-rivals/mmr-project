<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="fixed inset-2 flex items-center justify-center p-4 sm:inset-20">
  <div class="h-full max-h-96 w-full max-w-2xl">
    <div
      class="size-full rounded-2xl border border-orange-500 p-5 [background:linear-gradient(60deg,#001003,theme(colors.orange.950)_60%,#001003)_padding-box] sm:p-8"
    >
      {@render children?.()}
    </div>
  </div>
</div>
