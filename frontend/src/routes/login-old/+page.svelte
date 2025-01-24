<script lang="ts">
  import Button from '$lib/components/ui/button/button.svelte';
  import * as Form from '$lib/components/ui/form';
  import Input from '$lib/components/ui/input/input.svelte';
  import { superForm } from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import { loginSchema, type LoginForm } from './schema.js';

  let { data } = $props();
  let { supabase } = $derived(data);

  async function signInWithAzure() {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email',
        redirectTo: new URL(
          '/auth/callback',
          window.location.origin
        ).toString(),
      },
    });
  }

  const form = superForm<LoginForm>(data.form, {
    validators: zodClient(loginSchema),
    dataType: 'json',
    delayMs: 500,
  });

  const { form: formData, enhance, message } = form;
</script>

<form
  method="post"
  use:enhance
  class="container flex max-w-96 flex-col gap-2 pt-3"
>
  <Form.Field {form} name="email">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Email</Form.Label>
        <Input
          {...props}
          bind:value={$formData.email}
          type="email"
          placeholder="Enter your email address"
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="password">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Password</Form.Label>
        <Input
          {...props}
          bind:value={$formData.password}
          type="password"
          placeholder="Enter your password"
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  {#if $message}
    <p class="text-red-500">{$message}</p>
  {/if}
  <Form.Button>Login</Form.Button>
  <Button type="button" onclick={signInWithAzure} variant="secondary">
    Sign in with Azure
  </Button>
  <Button href="/signup" variant="link">No user? Sign up here.</Button>
</form>
