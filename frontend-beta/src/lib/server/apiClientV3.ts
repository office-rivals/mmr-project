import {
  Configuration,
  MeApi,
  OrganizationsApi,
  OrganizationMembersApi,
  LeaguesApi,
  LeaguePlayersApi,
  V3SeasonsApi,
  V3AdminSeasonsApi,
  V3MatchesApi,
  V3LeaderboardApi,
  V3RatingHistoryApi,
  V3StatisticsApi,
  V3QueueApi,
  V3PendingMatchesApi,
  V3ActiveMatchesApi,
  V3MatchFlagsApi,
  V3AdminMatchFlagsApi,
  V3PersonalAccessTokensApi,
  OrganizationInviteLinksApi,
  InvitesApi,
} from '@/api-v3';
import { auth } from '@clerk/tanstack-react-start/server';

/**
 * Request-scoped v3 API client bundle.
 *
 * `basePath` is read from `process.env` on every call rather than from
 * `import.meta.env`: the Docker image is built once and configured per
 * environment at run time, so anything Vite would inline at build time is
 * unusable here.
 */
export const createApiClientV3 = (getToken: () => Promise<string | null>) => {
  const configuration = new Configuration({
    basePath: process.env.API_BASE_PATH,
    middleware: [
      {
        pre: async (context) => {
          const token = await getToken();
          if (token) {
            context.init.headers = {
              ...context.init.headers,
              Authorization: `Bearer ${token}`,
            };
          }
          return context;
        },
      },
    ],
  });

  return {
    meApi: new MeApi(configuration),
    organizationsApi: new OrganizationsApi(configuration),
    organizationMembersApi: new OrganizationMembersApi(configuration),
    leaguesApi: new LeaguesApi(configuration),
    leaguePlayersApi: new LeaguePlayersApi(configuration),
    seasonsApi: new V3SeasonsApi(configuration),
    adminSeasonsApi: new V3AdminSeasonsApi(configuration),
    matchesApi: new V3MatchesApi(configuration),
    leaderboardApi: new V3LeaderboardApi(configuration),
    ratingHistoryApi: new V3RatingHistoryApi(configuration),
    statisticsApi: new V3StatisticsApi(configuration),
    queueApi: new V3QueueApi(configuration),
    pendingMatchesApi: new V3PendingMatchesApi(configuration),
    activeMatchesApi: new V3ActiveMatchesApi(configuration),
    matchFlagsApi: new V3MatchFlagsApi(configuration),
    adminMatchFlagsApi: new V3AdminMatchFlagsApi(configuration),
    personalAccessTokensApi: new V3PersonalAccessTokensApi(configuration),
    organizationInviteLinksApi: new OrganizationInviteLinksApi(configuration),
    invitesApi: new InvitesApi(configuration),
  };
};

export type ApiClientV3 = ReturnType<typeof createApiClientV3>;

/**
 * Builds the client for the current request, or throws a 401 Response when the
 * caller is not signed in. The Svelte app typed `locals.apiClientV3` as
 * non-optional while only assigning it for authenticated requests; making the
 * auth check part of the factory removes that unsound hole.
 */
export const requireApiClientV3 = async (): Promise<ApiClientV3> => {
  const { userId, getToken } = await auth();
  if (!userId) {
    throw new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return createApiClientV3(() => getToken());
};
