import {
  Configuration,
  MatchMakingApi,
  MMRV2Api,
  PersonalAccessTokensApi,
  ProfileApi,
  RolesApi,
  SeasonsApi,
  StatisticsApi,
  UsersApi,
} from '$api';
import { env } from '$env/dynamic/private';

export const createConfiguration = (getToken: () => Promise<string | null>) =>
  new Configuration({
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

export const createApiClient = (getToken: () => Promise<string | null>) => {
  const configuration = createConfiguration(getToken);
  return {
    mmrApi: new MMRV2Api(configuration),
    profileApi: new ProfileApi(configuration),
    statisticsApi: new StatisticsApi(configuration),
    usersApi: new UsersApi(configuration),
    matchmakingApi: new MatchMakingApi(configuration),
    seasonsApi: new SeasonsApi(configuration),
    personalAccessTokensApi: new PersonalAccessTokensApi(configuration),
    rolesApi: new RolesApi(configuration),
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
