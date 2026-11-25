import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import type { BadgesResponse } from '@/api-v3';

/** Separate from `['me']`: the counts change on their own schedule. */
export const badgesQueryKey = ['badges'] as const;

export const getBadges = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BadgesResponse | null> => {
    try {
      const apiClientV3 = await requireApiClientV3();
      return await apiClientV3.meApi.getBadges();
    } catch {
      return null;
    }
  }
);

export const badgesQueryOptions = () =>
  queryOptions({
    queryKey: badgesQueryKey,
    queryFn: () => getBadges(),
    staleTime: 0,
  });
