<script lang="ts">
  import LoadingOverlay from '$lib/components/loading-overlay.svelte';
  import PageTitle from '$lib/components/page-title.svelte';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { superForm } from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import type { PageServerData } from './$types';
  import { createPlayerSchema } from './schema';

  interface Props {
    data: PageServerData;
  }

  let { data }: Props = $props();

  const form = superForm(data.form, {
    validators: zodClient(createPlayerSchema),
    dataType: 'json',
    delayMs: 500,
  });

  const { form: formData, enhance, submitting, message } = form;
</script>

<form method="post" use:enhance class="flex flex-col gap-1">
  <PageTitle>Create player</PageTitle>

  <Form.Field {form} name="name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Initials</Form.Label>
        <Input
          {...props}
          bind:value={$formData.name}
          placeholder="Enter player's initials"
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="displayName">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Name</Form.Label>
        <Input
          {...props}
          bind:value={$formData.displayName}
          placeholder="Enter player's name"
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Button>Create player</Form.Button>
  {#if $message}
    <p class="text-red-500">{$message}</p>
  {/if}
</form>

<LoadingOverlay isLoading={$submitting} message="Creating new player" />
