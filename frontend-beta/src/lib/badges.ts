import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import type { BadgesResponse } from '@/api-v3';

/** Separate from `['me']`: the counts change on their own schedule. */
export const badgesQueryKey = ['badges'] as const;

/**
 * Open match-flag counts for the admin tree. Non-fatal by construction — a
 * failure yields `null` and every badge falls back to 0 rather than taking the
 * page down with it.
 */
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
