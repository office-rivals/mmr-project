import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { OrganizationRole } from '@/api-v3';
import { refreshAuthedShellData, requireSuccessfulShellRefresh } from './shell';
import type { AuthedShellData } from './shell';

const shell = (leagueSlugs: string[]): AuthedShellData => {
  const leagues = leagueSlugs.map((slug) => ({
    id: `${slug}-id`,
    name: slug,
    slug,
    teamSize: 1,
    leaguePlayerId: `${slug}-player-id`,
  }));
  const defaultLeague = leagues[0];

  return {
    userId: 'user-id',
    organizations: [
      {
        id: 'org-id',
        name: 'Test Organization',
        slug: 'test-org',
        role: OrganizationRole.Member,
        leagues,
      },
    ],
    profileLoadFailed: false,
    displayName: 'Player',
    username: null,
    openFlagCount: 0,
    defaultOrgSlug: defaultLeague ? 'test-org' : null,
    defaultLeagueSlug: defaultLeague?.slug ?? null,
    defaultOrgId: defaultLeague ? 'org-id' : null,
    defaultLeagueId: defaultLeague?.id ?? null,
    defaultLeaguePlayerId: defaultLeague?.leaguePlayerId ?? null,
  };
};

describe('shell cache refresh', () => {
  it('replaces a stale unobserved entry before it is consumed by a loader', async () => {
    const queryClient = new QueryClient();
    const queryFn = vi.fn().mockResolvedValue(shell(['new-league']));
    queryClient.setQueryData(['me'], shell([]));

    const cached = await queryClient.ensureQueryData({
      queryKey: ['me'],
      queryFn,
      staleTime: 0,
    });
    expect(cached.organizations[0].leagues).toHaveLength(0);
    expect(queryFn).not.toHaveBeenCalled();

    const fresh = await refreshAuthedShellData(queryClient, queryFn);
    expect(fresh.organizations[0].leagues[0]?.slug).toBe('new-league');
    expect(
      queryClient.getQueryData<AuthedShellData>(['me'])?.organizations[0]
        .leagues[0]?.slug
    ).toBe('new-league');
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('rejects the degraded profile snapshot used by profile-independent routes', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['me'], {
      ...shell([]),
      profileLoadFailed: true,
    });

    expect(() => requireSuccessfulShellRefresh(queryClient)).toThrow(
      'Failed to refresh user profile'
    );
  });
});
