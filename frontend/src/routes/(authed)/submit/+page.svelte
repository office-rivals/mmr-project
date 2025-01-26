<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import type { PageServerData } from './$types';
  import MatchForm from './components/match-form.svelte';

  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();
</script>

<div class="flex flex-col gap-8">
  <PageTitle>Submit match</PageTitle>
  <MatchForm initialData={data.form} users={data.users} />
</div>
