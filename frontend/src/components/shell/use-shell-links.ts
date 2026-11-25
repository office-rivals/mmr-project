import { useMatch, useParams } from '@tanstack/react-router';

export interface ShellDefaults {
  defaultOrgSlug: string | null;
  defaultLeagueSlug: string | null;
  defaultOrgId: string | null;
  defaultLeagueId: string | null;
  defaultLeaguePlayerId: string | null;
}

/** League-scoped shell links; the current route's league wins over defaults. */
export function useShellLinks(defaults: ShellDefaults) {
  const params = useParams({ strict: false });
  const leagueMatch = useMatch({
    from: '/_authed/$orgSlug/$leagueSlug',
    shouldThrow: false,
  });
  const league = leagueMatch?.loaderData;

  const orgSlug = params.orgSlug ?? defaults.defaultOrgSlug;
  const leagueSlug = params.leagueSlug ?? defaults.defaultLeagueSlug;
  const orgId = league?.orgId ?? defaults.defaultOrgId;
  const leagueId = league?.leagueId ?? defaults.defaultLeagueId;
  const leaguePlayerId =
    league?.leaguePlayerId ?? defaults.defaultLeaguePlayerId;

  const base = orgSlug && leagueSlug ? `/${orgSlug}/${leagueSlug}` : null;
  const profilePath =
    base && leaguePlayerId ? `${base}/player/${leaguePlayerId}` : '/settings';

  return { base, orgId, leagueId, leaguePlayerId, profilePath };
}
