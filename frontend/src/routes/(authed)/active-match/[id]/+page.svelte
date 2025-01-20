<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import type { PageServerData } from './$types';
  import ActiveMatchSubmitForm from './components/active-match-submit-form.svelte';

  export let data: PageServerData;
</script>

<div class="flex flex-col gap-8">
  <PageTitle>Submit match</PageTitle>

  <ActiveMatchSubmitForm
    data={data.form}
    activeMatch={data.activeMatch}
    currentPlayerId={data.currentPlayerId}
    users={data.users}
  />
</div>
