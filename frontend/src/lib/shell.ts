import { queryOptions } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { loadShellDataOnce } from '@/lib/server/shell';
import type { MeOrganizationResponse } from '@/api-v3';

export interface AuthedShellData {
  userId: string | null;
  organizations: MeOrganizationResponse[];
  /** True only when `getMe()` itself threw — not when it returned zero orgs. */
  profileLoadFailed: boolean;
  displayName: string | null;
  username: string | null;
  /** Total open match flags across organizations this user administers. */
  openFlagCount: number;
  defaultOrgSlug: string | null;
  defaultLeagueSlug: string | null;
  defaultOrgId: string | null;
  defaultLeagueId: string | null;
  defaultLeaguePlayerId: string | null;
}

export const meQueryKey = ['me'] as const;

export const getAuthedShellData = createServerFn({ method: 'GET' }).handler(
  (): Promise<AuthedShellData> => loadShellDataOnce()
);

export const authedShellQueryOptions = () =>
  queryOptions({
    queryKey: meQueryKey,
    queryFn: () => getAuthedShellData(),
    staleTime: 0,
  });

// Loader queries have no observer for invalidateQueries to refetch.
export function refreshAuthedShellData(
  queryClient: QueryClient,
  queryFn: () => Promise<AuthedShellData> = getAuthedShellData
) {
  return queryClient.fetchQuery({ ...authedShellQueryOptions(), queryFn });
}

export function requireSuccessfulShellRefresh(queryClient: QueryClient) {
  const shell = queryClient.getQueryData<AuthedShellData>(meQueryKey);
  if (!shell || shell.profileLoadFailed) {
    throw new Error('Failed to refresh user profile');
  }
  return shell;
}
