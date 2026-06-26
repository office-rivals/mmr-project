import { openFlagsForLeague, openFlagsForOrg } from '$lib/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId, badges } = await parent();

  const [members, leagues] = await Promise.all([
    apiClientV3.organizationMembersApi.listMembers(orgId),
    apiClientV3.leaguesApi.listLeagues(orgId),
  ]);

  // Open-flag counts come from the badges endpoint (one grouped query
  // server-side) rather than a per-league fan-out.
  const openFlagsTotal = openFlagsForOrg(badges, orgId);
  const openFlagsPerLeague = leagues.map((league) => ({
    leagueId: league.id,
    count: openFlagsForLeague(badges, league.id),
  }));

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
