<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { LoaderCircle } from 'lucide-svelte';
  interface Props {
    isLoading: boolean;
  }

  let { isLoading = $bindable() }: Props = $props();
</script>

<Dialog.Root bind:open={isLoading}>
  <Dialog.Content
    escapeKeydownBehavior="defer-otherwise-ignore"
    interactOutsideBehavior="defer-otherwise-ignore"
    class="loading-dialog flex flex-col items-center justify-center"
  >
    Uploading match result
    <LoaderCircle class="animate-spin" />
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.loading-dialog > button[data-dialog-close]) {
    display: none;
  }
</style>
