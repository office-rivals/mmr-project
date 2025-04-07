import {
  Configuration,
  MatchMakingApi,
  MMRV2Api,
  ProfileApi,
  SeasonsApi,
  StatisticsApi,
  UsersApi,
} from '$api';
import { env } from '$env/dynamic/private';

export const createConfiguration = (token: string) =>
  new Configuration({
    basePath: env.API_BASE_PATH,
    headers: { Authorization: `Bearer ${token}` },
  });

export const createApiClient = (token: string) => {
  const configuration = createConfiguration(token);
  return {
    mmrApi: new MMRV2Api(configuration),
    profileApi: new ProfileApi(configuration),
    statisticsApi: new StatisticsApi(configuration),
    usersApi: new UsersApi(configuration),
    matchmakingApi: new MatchMakingApi(configuration),
    seasonsApi: new SeasonsApi(configuration),
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
