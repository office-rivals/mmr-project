import {
  Configuration,
  MeApi,
  OrganizationsApi,
  OrganizationMembersApi,
  LeaguesApi,
  LeaguePlayersApi,
  V3SeasonsApi,
  V3MatchesApi,
  V3LeaderboardApi,
  V3RatingHistoryApi,
  V3QueueApi,
  V3PendingMatchesApi,
  V3ActiveMatchesApi,
  V3MatchFlagsApi,
  V3AdminMatchFlagsApi,
  V3PersonalAccessTokensApi,
} from '$api3';
import { env } from '$env/dynamic/private';

export const createApiClientV3 = (getToken: () => Promise<string | null>) => {
  const configuration = new Configuration({
    basePath: env.API_BASE_PATH,
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
    matchesApi: new V3MatchesApi(configuration),
    leaderboardApi: new V3LeaderboardApi(configuration),
    ratingHistoryApi: new V3RatingHistoryApi(configuration),
    queueApi: new V3QueueApi(configuration),
    pendingMatchesApi: new V3PendingMatchesApi(configuration),
    activeMatchesApi: new V3ActiveMatchesApi(configuration),
    matchFlagsApi: new V3MatchFlagsApi(configuration),
    adminMatchFlagsApi: new V3AdminMatchFlagsApi(configuration),
    personalAccessTokensApi: new V3PersonalAccessTokensApi(configuration),
  };
};

export type ApiClientV3 = ReturnType<typeof createApiClientV3>;
