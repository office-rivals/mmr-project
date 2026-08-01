import { useMatch, useParams } from '@tanstack/react-router';
import { Home, Plus, Shuffle, User } from 'lucide-react';
import { MatchmakingButton } from './matchmaking-button';
import { NavbarNav } from './navbar-nav';

interface NavbarProps {
  defaultOrgSlug: string | null;
  defaultLeagueSlug: string | null;
  defaultOrgId: string | null;
  defaultLeagueId: string | null;
  defaultLeaguePlayerId: string | null;
}

export function Navbar({
  defaultOrgSlug,
  defaultLeagueSlug,
  defaultOrgId,
  defaultLeagueId,
  defaultLeaguePlayerId,
}: NavbarProps) {
  const params = useParams({ strict: false });
  // Replaces `page.data.orgId / leagueId / leaguePlayerId`, which the league
  // layout published into SvelteKit's page store.
  const leagueMatch = useMatch({
    from: '/_authed/$orgSlug/$leagueSlug',
    shouldThrow: false,
  });
  const league = leagueMatch?.loaderData;

  // The league the user is currently inside wins over the layout defaults.
  const orgSlug = params.orgSlug ?? defaultOrgSlug;
  const leagueSlug = params.leagueSlug ?? defaultLeagueSlug;
  const orgId = league?.orgId ?? defaultOrgId;
  const leagueId = league?.leagueId ?? defaultLeagueId;
  const leaguePlayerId = league?.leaguePlayerId ?? defaultLeaguePlayerId;

  const base = orgSlug && leagueSlug ? `/${orgSlug}/${leagueSlug}` : null;
  const profilePath =
    base && leaguePlayerId ? `${base}/player/${leaguePlayerId}` : '/settings';

  // A user with no joined league anywhere, off a league route, gets no navbar
  // at all — not a stub nav with dead links.
  if (!base) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex w-screen flex-row justify-center border-t bg-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex w-full max-w-screen-sm flex-row items-center justify-stretch">
        <NavbarNav path={base}>
          <Home />
        </NavbarNav>
        {orgId && leagueId && (
          <MatchmakingButton
            path={`${base}/matchmaking`}
            orgId={orgId}
            leagueId={leagueId}
          />
        )}
        <NavbarNav isPrimary path={`${base}/submit`}>
          <Plus />
        </NavbarNav>
        <NavbarNav path="/random">
          <Shuffle />
        </NavbarNav>
        <NavbarNav path={profilePath}>
          <User />
        </NavbarNav>
      </div>
    </nav>
  );
}
