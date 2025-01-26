<script lang="ts">
  import LoadingOverlay from '$lib/components/loading-overlay.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import * as Form from '$lib/components/ui/form';
  import Input from '$lib/components/ui/input/input.svelte';
  import { superForm } from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import { signupSchema, type SignupForm } from './schema.js';

  let { data } = $props();

  const form = superForm<SignupForm>(data.form, {
    validators: zodClient(signupSchema),
    dataType: 'json',
    delayMs: 500,
  });

  const { form: formData, enhance, submitting } = form;
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
  <Form.Button>Sign up</Form.Button>
  <Button href="/login" variant="link">Already have a user? Login here.</Button>
</form>

<LoadingOverlay isLoading={$submitting} />
