<script lang="ts">
  import { goto } from '$app/navigation';
  import PageTitle from '$lib/components/page-title.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import { Ticket } from 'lucide-svelte';

  let code = $state('');
  let error = $state('');

  function handleSubmit() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      error = 'Invite code must be 6 characters';
      return;
    }
    error = '';
    goto(`/join/${trimmed}`);
  }
</script>

<div class="flex flex-col items-center justify-center gap-8 py-16">
  <Ticket class="text-muted-foreground h-16 w-16" />
  <div class="flex flex-col gap-2 text-center">
    <PageTitle>Join an Organization</PageTitle>
    <p class="text-muted-foreground max-w-md">
      Enter the 6-character invite code you received to join an organization.
    </p>
  </div>

  <form
    class="flex w-full max-w-sm flex-col gap-4"
    onsubmit={(e) => {
      e.preventDefault();
      handleSubmit();
    }}
  >
    <div class="flex flex-col gap-2">
      <Label for="invite-code">Invite Code</Label>
      <Input
        id="invite-code"
        bind:value={code}
        placeholder="e.g. ABC123"
        maxlength={6}
        class="text-center text-2xl uppercase tracking-widest"
      />
    </div>
    {#if error}
      <p class="text-sm text-red-500">{error}</p>
    {/if}
    <Button type="submit" disabled={code.trim().length === 0}>Continue</Button>
  </form>
</div>
