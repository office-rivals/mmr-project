<script lang="ts">
  import PageTitle from '$lib/components/page-title.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { flyAndScale } from '$lib/utils';
  import { Combobox } from 'bits-ui';
  import type { PageServerData } from './$types';

  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();

  let inputValue = $state('');

  let filteredUsers = $derived(
    inputValue !== ''
      ? data.users
          .filter(
            (user) =>
              user.displayName
                ?.toLowerCase()
                .includes(inputValue.toLowerCase()) ||
              user.name.toLowerCase().includes(inputValue.toLowerCase())
          )
          .map((user) => ({
            value: user.userId.toString(),
            label: user.displayName ?? user.name,
          }))
      : []
  );
</script>

<div class="flex flex-col space-y-6">
  <PageTitle>Claim player</PageTitle>

  <form method="post" class="flex flex-col space-y-4">
    <Combobox.Root type="single" items={filteredUsers} name="userId">
      <div class="relative">
        <Combobox.Input
          oninput={(e) => (inputValue = e.currentTarget.value)}
          placeholder="Pick a player"
          aria-label="Pick a player"
          class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <Combobox.Content
        forceMount
        class="border-muted bg-background shadow-popover w-full rounded-xl border px-1 py-3 outline-none"
        align="start"
        strategy="absolute"
        sideOffset={8}
      >
        {#snippet child({ wrapperProps, props, open })}
          {#if open}
            <div {...wrapperProps}>
              <div {...props} transition:flyAndScale={{}}>
                {#each filteredUsers as user (user.value)}
                  <Combobox.Item
                    class="rounded-button data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground p-y-4 flex h-10 w-full select-none items-center p-3 outline-none transition-all duration-75"
                    value={user.value}
                    label={user.label}
                  >
                    {#snippet children({})}
                      {user.label}
                    {/snippet}
                  </Combobox.Item>
                {:else}
                  <span class="block px-5 py-2 text-sm text-muted-foreground">
                    No results found
                  </span>
                {/each}
              </div>
            </div>
          {/if}
        {/snippet}
      </Combobox.Content>
    </Combobox.Root>
    <Button type="submit">Claim player</Button>
  </form>
</div>
