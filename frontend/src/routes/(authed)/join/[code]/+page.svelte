<script lang="ts">
  import { enhance } from '$app/forms';
  import PageTitle from '$lib/components/page-title.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';
  import CardHeader from '$lib/components/ui/card/card-header.svelte';
  import CardTitle from '$lib/components/ui/card/card-title.svelte';
  import Card from '$lib/components/ui/card/card.svelte';
  import { AlertCircle, Building2, CheckCircle2 } from 'lucide-svelte';
  import type { ActionData, PageData } from './$types';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();
  let isJoining = $state(false);
</script>

<div class="flex flex-col items-center justify-center gap-8 py-16">
  {#if !data.invite.isValid}
    <AlertCircle class="h-16 w-16 text-red-500" />
    <div class="flex flex-col gap-2 text-center">
      <PageTitle>Invalid Invite</PageTitle>
      <p class="max-w-md text-muted-foreground">
        {#if data.invite.organizationName}
          This invite to <strong>{data.invite.organizationName}</strong> has expired
          or reached its usage limit.
        {:else}
          This invite code is not valid. Please check the code and try again.
        {/if}
      </p>
    </div>
    <Button href="/join" variant="outline">Try Another Code</Button>
  {:else if data.alreadyMember}
    <Card class="w-full max-w-md">
      <CardHeader class="items-center text-center">
        <CheckCircle2 class="mb-2 h-12 w-12 text-green-500" />
        <CardTitle>You're already a member</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-6">
          <div class="text-center">
            <p class="text-sm text-muted-foreground">
              You're already a member of
            </p>
            <p class="text-2xl font-bold">{data.invite.organizationName}</p>
          </div>
          <Button href="/{data.invite.organizationSlug}" class="w-full">
            Go to {data.invite.organizationName}
          </Button>
        </div>
      </CardContent>
    </Card>
  {:else}
    <Card class="w-full max-w-md">
      <CardHeader class="items-center text-center">
        <Building2 class="mb-2 h-12 w-12 text-primary" />
        <CardTitle>You've been invited!</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-6">
          <div class="text-center">
            <p class="text-sm text-muted-foreground">You're invited to join</p>
            <p class="text-2xl font-bold">{data.invite.organizationName}</p>
          </div>

          {#if form?.error}
            <div
              class="flex items-start gap-2 rounded-lg border border-l-4 border-red-500 bg-red-950/20 p-4"
            >
              <AlertCircle class="mt-0.5 shrink-0 text-red-500" size={20} />
              <p class="text-sm text-red-500">{form.error}</p>
            </div>
          {/if}

          <form
            method="post"
            action="?/join"
            use:enhance={() => {
              isJoining = true;
              return async ({ update }) => {
                await update();
                isJoining = false;
              };
            }}
          >
            <Button type="submit" class="w-full" disabled={isJoining}>
              {isJoining ? 'Joining...' : 'Join Organization'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  {/if}
</div>
