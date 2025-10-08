<script>
  import PageTitle from '$lib/components/page-title.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Info } from 'lucide-svelte';
  import { SignOutButton } from 'svelte-clerk';
</script>

<div class="flex flex-col gap-3">
  <PageTitle>Profile</PageTitle>

  <div class="border-l-primary flex space-x-2 border border-l-4 p-4">
    <Info class="text-4xl text-white" size="1em" />
    <div class="flex flex-1 flex-col space-y-2">
      <span class="text-white">You have not claimed a player yet</span>
      <Button href="/profile/claim">Claim a player</Button>
    </div>
  </div>

  <SignOutButton>
    <Button variant="secondary">Logout</Button>
  </SignOutButton>
</div>
