<script lang="ts">
  import { enhance } from '$app/forms';
  import { Alert } from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '$lib/components/ui/card';
  import { Label } from '$lib/components/ui/label';
  import { formatDate } from '$lib/utils';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="mx-auto max-w-2xl space-y-6">
  <div class="space-y-1">
    <h1 class="text-2xl font-bold tracking-tight">Claim your player</h1>
    <p class="text-sm text-muted-foreground">
      Choose the existing player whose matches and rating belong to you.
    </p>
  </div>

  {#if form?.error}
    <Alert variant="destructive">{form.error}</Alert>
  {/if}
  {#if form?.success}
    <Alert variant="success">{form.success}</Alert>
  {/if}

  {#if !data.org || !data.claimable}
    <Alert variant="destructive">Organization not found</Alert>
  {:else if data.claimRequest?.status === 'Pending'}
    <Card data-testid="claim-pending">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          Claim awaiting approval
          <Badge variant="outline">Pending</Badge>
        </CardTitle>
        <CardDescription>
          A moderator will confirm that
          {data.claimRequest.target.displayName ?? 'this player'} is you.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Alert>
          Do not play matches until this request is decided. Match activity on
          this account can prevent the claim from being approved.
        </Alert>
        <form method="POST" action="?/cancel" use:enhance>
          <input type="hidden" name="claimId" value={data.claimRequest.id} />
          <Button type="submit" variant="outline" data-testid="claim-cancel"
            >Cancel request</Button
          >
        </form>
      </CardContent>
    </Card>
  {:else if data.claimRequest?.status === 'Approved'}
    <Alert variant="success">
      Your player claim was approved. Your existing matches and rating now
      belong to this account.
    </Alert>
    <Button href={`/${data.org.slug}`}>Back to organization</Button>
  {:else}
    {#if data.claimRequest?.status === 'Rejected'}
      <Alert variant="destructive">
        This claim was rejected{data.claimRequest.reviewNote
          ? `: ${data.claimRequest.reviewNote}`
          : '.'}
      </Alert>
    {/if}

    {#if data.claimable.requesterEligible}
      <form method="POST" action="?/submit" use:enhance class="space-y-5">
        <fieldset class="space-y-3">
          <legend class="font-medium">Which player are you?</legend>
          {#each data.claimable.memberships as player (player.organizationMembershipId)}
            <label
              class="flex cursor-pointer gap-3 rounded-lg border p-4 hover:bg-muted/40"
            >
              <input
                type="radio"
                name="membershipId"
                value={player.organizationMembershipId}
                data-testid={`claim-option-${player.organizationMembershipId}`}
                required
                class="mt-1"
              />
              <span class="min-w-0 flex-1 space-y-1">
                <span class="block font-medium">
                  {player.displayName ?? player.username ?? 'Unnamed player'}
                </span>
                {#if player.username}
                  <span class="block text-sm text-muted-foreground"
                    >@{player.username}</span
                  >
                {/if}
                <span class="block text-sm text-muted-foreground">
                  {player.matchCount} match{player.matchCount === 1 ? '' : 'es'}
                  {#if player.lastPlayedAt}
                    · last played {formatDate(player.lastPlayedAt)}
                  {/if}
                </span>
              </span>
            </label>
          {/each}
        </fieldset>

        <div class="space-y-2">
          <Label for="claim-note">Note for the moderator (optional)</Label>
          <textarea
            id="claim-note"
            name="note"
            rows="3"
            class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Anything that helps them recognize you"
          ></textarea>
        </div>

        <div class="flex gap-3">
          <Button type="submit" data-testid="claim-submit">Request claim</Button
          >
          <Button
            href={`/${data.org.slug}`}
            variant="outline"
            data-testid="claim-skip">Skip for now</Button
          >
        </div>
      </form>
    {:else}
      <Alert>No player is currently available for this account to claim.</Alert>
      <Button href={`/${data.org.slug}`} variant="outline">Back</Button>
    {/if}
  {/if}
</div>
