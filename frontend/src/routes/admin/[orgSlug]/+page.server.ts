import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId } = await parent();

  const [members, leagues] = await Promise.all([
    apiClientV3.organizationMembersApi.listMembers(orgId),
    apiClientV3.leaguesApi.listLeagues(orgId),
  ]);

  // Pull open-flag counts per league. The list endpoint is league-scoped, so
  // we fan out one request per league. For orgs with a handful of leagues this
  // is fine; if it ever balloons we can add a backend aggregation endpoint.
  const openFlagsPerLeague = await Promise.all(
    leagues.map(async (league) => {
      try {
        const flags = await apiClientV3.adminMatchFlagsApi.listAllFlags(
          orgId,
          league.id,
          'Open' as never
        );
        return { leagueId: league.id, count: flags.length };
      } catch {
        return { leagueId: league.id, count: 0 };
      }
    })
  );

  const openFlagsTotal = openFlagsPerLeague.reduce(
    (sum, x) => sum + x.count,
    0
  );

  const activeMembers = members.filter((m) => m.status === 'Active');
  const ownerCount = activeMembers.filter((m) => m.role === 'Owner').length;
  const moderatorCount = activeMembers.filter(
    (m) => m.role === 'Moderator'
  ).length;
  const memberCount = activeMembers.filter((m) => m.role === 'Member').length;

  return {
    leagues,
    leagueCount: leagues.length,
    activeMemberCount: activeMembers.length,
    ownerCount,
    moderatorCount,
    memberCount,
    openFlagsTotal,
    openFlagsPerLeague: Object.fromEntries(
      openFlagsPerLeague.map((x) => [x.leagueId, x.count])
    ) as Record<string, number>,
  };
};
