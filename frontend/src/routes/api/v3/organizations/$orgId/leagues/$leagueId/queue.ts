import { createFileRoute } from '@tanstack/react-router';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';

/**
 * Deliberate improvement over the Svelte app (spec 02 §4.3): both queue pollers
 * there fetch this exact URL from the browser, but no proxy route ever existed,
 * so every poll 404s and the navbar queue badge never appears. Implementing the
 * route makes the intended behaviour work.
 *
 * Response shape is V3QueueApi.getQueueStatus's QueueStatusResponse, unchanged,
 * so the "0 queued → no badge" / "error → keep previous value" client rules
 * still apply as written.
 */
export const Route = createFileRoute(
  '/api/v3/organizations/$orgId/leagues/$leagueId/queue'
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const apiClientV3 = await requireApiClientV3();
        const status = await apiClientV3.queueApi.getQueueStatus(
          params.orgId,
          params.leagueId
        );

        return Response.json(status);
      },
    },
  },
});
