<script lang="ts">
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import type { FormPath, Infer, SuperForm } from 'sveltekit-superforms';
  import type { MatchSchema } from '../match-schema';

  interface Props {
    form: SuperForm<Infer<MatchSchema>>;
    name: FormPath<Infer<MatchSchema>>;
    value: string;
    label: string;
    placeholder?: string;
  }

  let {
    form,
    name,
    value = $bindable(),
    label,
    placeholder = '',
  }: Props = $props();
</script>

<Form.Field {form} {name}>
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>{label}</Form.Label>
      <Input
        {...props}
        bind:value
        class="lowercase placeholder:normal-case"
        {placeholder}
      />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>
