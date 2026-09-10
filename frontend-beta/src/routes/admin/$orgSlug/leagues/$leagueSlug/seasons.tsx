import { useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { CalendarDays, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HttpErrorView } from '@/components/http-error-view';
import { failServerAction } from '@/lib/server/action-result';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireAdminOrg, resolveOrgAndLeagueIds } from '@/lib/server/admin';
import { selectCurrentSeason } from '@/lib/util/season';
import { formatDateTime } from '@/lib/utils';
import type { SeasonResponse } from '@/api-v3';

type ActionResult = { success: boolean; message: string };

const loadSeasonsFn = createServerFn({ method: 'GET' })
  .validator((input: { orgSlug: string; leagueId: string }) => input)
  .handler(
    async ({ data }): Promise<{ seasons: SeasonResponse[]; now: number }> => {
      const org = await requireAdminOrg(data.orgSlug);
      const apiClientV3 = await requireApiClientV3();
      // Admins manage upcoming seasons, so this is the UNFILTERED admin
      // endpoint — not `seasonsApi.listSeasons`.
      const seasons = await apiClientV3.adminSeasonsApi.listAllSeasons(
        org.id,
        data.leagueId
      );
      // Pinned so the Current/Scheduled/Past split is identical on the server
      // and after hydration.
      return { seasons, now: Date.now() };
    }
  );

const createSeasonFn = createServerFn({ method: 'POST' })
  .validator(
    (input: { orgSlug: string; leagueSlug: string; startsAt: string }) => input
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const startsAtRaw = data.startsAt.trim();
    if (!startsAtRaw) {
      return failServerAction(400, {
        success: false,
        message: 'Start date is required',
      });
    }

    // The `datetime-local` value is a naive local string parsed in the
    // *server's* timezone. Latent quirk, preserved deliberately.
    const startsAt = new Date(startsAtRaw);
    if (Number.isNaN(startsAt.getTime())) {
      return failServerAction(400, {
        success: false,
        message: 'Invalid start date',
      });
    }

    const apiClientV3 = await requireApiClientV3();
    const ctx = await resolveOrgAndLeagueIds(apiClientV3, data);
    if (!ctx)
      return failServerAction(404, {
        success: false,
        message: 'Org or league not found',
      });

    try {
      // The non-admin seasons client is what creates a season.
      await apiClientV3.seasonsApi.createSeason(ctx.orgId, ctx.leagueId, {
        startsAt: startsAt.toISOString(),
      });
      return { success: true, message: 'Season created' };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to create season'
      );
      return failServerAction(status, { success: false, message });
    }
  });

export const Route = createFileRoute(
  '/admin/$orgSlug/leagues/$leagueSlug/seasons'
)({
  loader: ({ context, params }) =>
    loadSeasonsFn({
      data: { orgSlug: params.orgSlug, leagueId: context.leagueId },
    }),
  errorComponent: HttpErrorView,
  component: SeasonsPage,
});

function SeasonsPage() {
  const { orgSlug, leagueSlug } = Route.useParams();
  const { seasons, now } = Route.useLoaderData();
  const router = useRouter();

  const [result, setResult] = useState<ActionResult | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const sortedSeasons = [...seasons].sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
  );
  const currentSeasonId = selectCurrentSeason(seasons, now)?.id ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          {/* level 2 — the sub-nav tab shares this accessible name. */}
          <h2 className="text-xl font-semibold">Seasons</h2>
          <p className="text-sm text-muted-foreground">
            A new season resets ratings and starts a fresh leaderboard from its
            start date.
          </p>
        </div>
        <Button
          variant={showCreate ? 'ghost' : 'default'}
          onClick={() => setShowCreate((open) => !open)}
        >
          <Plus className="mr-2 h-4 w-4" />
          {showCreate ? 'Cancel' : 'New season'}
        </Button>
      </div>

      {result?.success ? (
        <Alert variant="success">{result.message}</Alert>
      ) : result?.success === false ? (
        <Alert variant="destructive">{result.message}</Alert>
      ) : null}

      {showCreate && (
        <Card>
          <CardHeader>
            {/* The Svelte Card.Title was an <h3>; the shadcn CLI one is a
                <div>. `admin.spec` locates this by role=heading, so the role is
                restored here rather than by patching the shared primitive. */}
            <CardTitle role="heading" aria-level={3}>
              Start a new season
            </CardTitle>
            <CardDescription>
              Pick a start date in the future to schedule, or now to start
              immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
              onSubmit={async (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                let actionResult: ActionResult;
                try {
                  actionResult = await createSeasonFn({
                    data: {
                      orgSlug,
                      leagueSlug,
                      startsAt: String(formData.get('startsAt') ?? ''),
                    },
                  });
                } catch {
                  actionResult = {
                    success: false,
                    message: 'Request failed. Please try again.',
                  };
                }
                setResult(actionResult);
                if (actionResult.success)
                  await router.invalidate({ sync: true });
                if (actionResult.success) setShowCreate(false);
              }}
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="startsAt">Starts at</Label>
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  required
                />
              </div>
              <Button type="submit">Create season</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All seasons</CardTitle>
          <CardDescription>
            {`${seasons.length} season${seasons.length === 1 ? '' : 's'} total`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedSeasons.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No seasons yet. Create one to start tracking rated matches.
            </p>
          ) : (
            <div className="space-y-2">
              {sortedSeasons.map((season) => (
                <div
                  key={season.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">
                        {formatDateTime(season.startsAt)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {`Created ${formatDateTime(season.createdAt)}`}
                      </p>
                    </div>
                  </div>
                  {season.id === currentSeasonId ? (
                    <Badge>Current</Badge>
                  ) : new Date(season.startsAt).getTime() > now ? (
                    <Badge variant="outline">Scheduled</Badge>
                  ) : (
                    <Badge variant="secondary">Past</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
