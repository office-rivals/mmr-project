<script lang="ts">
  import * as Button from '$lib/components/ui/button/index.js';

  let props: Button.ButtonOnlyProps = $props();
</script>

<Button.Root type="submit" {...props} />
