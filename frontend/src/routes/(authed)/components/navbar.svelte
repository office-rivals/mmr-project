<script lang="ts">
  import { page } from '$app/state';
  import { Home, Plus, Shuffle, User } from 'lucide-svelte';
  import MatchmakingButton from './matchmaking-button.svelte';
  import NavbarNav from './navbar-nav.svelte';

  interface Props {
    defaultOrgSlug: string | null;
    defaultLeagueSlug: string | null;
    defaultOrgId: string | null;
    defaultLeagueId: string | null;
    defaultLeaguePlayerId: string | null;
  }

  let {
    defaultOrgSlug,
    defaultLeagueSlug,
    defaultOrgId,
    defaultLeagueId,
    defaultLeaguePlayerId,
  }: Props = $props();

  // Prefer the league context the user is currently inside (from URL params).
  const orgSlug = $derived(page.params.orgSlug ?? defaultOrgSlug);
  const leagueSlug = $derived(page.params.leagueSlug ?? defaultLeagueSlug);
  const orgId = $derived(
    (page.data as { orgId?: string }).orgId ?? defaultOrgId
  );
  const leagueId = $derived(
    (page.data as { leagueId?: string }).leagueId ?? defaultLeagueId
  );
  const leaguePlayerId = $derived(
    (page.data as { leaguePlayerId?: string | null }).leaguePlayerId ??
      defaultLeaguePlayerId
  );

  const base = $derived(
    orgSlug && leagueSlug ? `/${orgSlug}/${leagueSlug}` : null
  );
  const profilePath = $derived(
    base && leaguePlayerId ? `${base}/player/${leaguePlayerId}` : '/settings'
  );
</script>

{#if base}
  <nav
    class="bg-card fixed bottom-0 left-0 right-0 flex w-screen flex-row justify-center border-t"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <div class="flex w-full max-w-screen-sm flex-row items-center justify-stretch">
      <NavbarNav path={base}>
        <Home />
      </NavbarNav>
      {#if orgId && leagueId}
        <MatchmakingButton path="{base}/matchmaking" {orgId} {leagueId} />
      {/if}
      <NavbarNav isPrimary path="{base}/submit"><Plus /></NavbarNav>
      <NavbarNav path="/random"><Shuffle /></NavbarNav>
      <NavbarNav path={profilePath}><User /></NavbarNav>
    </div>
  </nav>
{/if}
