import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Link,
  createFileRoute,
  getRouteApi,
  useRouter,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Plus, Trophy } from 'lucide-react';
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
import { OpenFlagBadge } from '@/components/admin/open-flag-badge';
import { failServerAction } from '@/lib/server/action-result';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireAdminOrg, resolveOrgIdBySlug } from '@/lib/server/admin';
import { refreshAuthedShellData } from '@/lib/shell';
import { formatLeagueFormat, openFlagsForLeague } from '@/lib/utils';
import type { LeagueResponse } from '@/api-v3';

type ActionResult = { error?: string; success?: string };

const loadLeaguesFn = createServerFn({ method: 'GET' })
  .validator((orgSlug: string) => orgSlug)
  .handler(async ({ data: orgSlug }): Promise<LeagueResponse[]> => {
    const org = await requireAdminOrg(orgSlug);
    const apiClientV3 = await requireApiClientV3();
    return apiClientV3.leaguesApi.listLeagues(org.id);
  });

const createLeagueFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      orgSlug: string;
      name: string;
      slug: string;
      teamSize: string;
      winningScore: string;
    }) => input
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const name = data.name.trim();
    const slug = data.slug.trim();
    const teamSize = Number(data.teamSize);
    const winningScoreRaw = data.winningScore.trim();

    if (!name) return failServerAction(400, { error: 'Name is required' });
    if (!slug) return failServerAction(400, { error: 'Slug is required' });

    // Blank input = free-form scoring, i.e. an explicit `null` on the wire
    // (`undefined` would mean "server default of 10"). There is deliberately no
    // client-side upper bound: the API's 255 cap surfaces through its
    // ProblemDetails `detail`, which `winning-score.spec.ts` asserts on.
    let winningScore: number | null = null;
    if (winningScoreRaw) {
      const parsed = Number(winningScoreRaw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return failServerAction(400, {
          error:
            'Winning score must be a positive integer, or blank for free-form',
        });
      }
      winningScore = parsed;
    }

    const apiClientV3 = await requireApiClientV3();
    const orgId = await resolveOrgIdBySlug(apiClientV3, data.orgSlug);
    if (!orgId)
      return failServerAction(404, { error: 'Organization not found' });

    try {
      await apiClientV3.leaguesApi.createLeague(orgId, {
        name,
        slug,
        teamSize,
        winningScore,
      });
      return { success: 'League created' };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to create league'
      );
      return failServerAction(status, { error: message });
    }
  });

export const Route = createFileRoute('/admin/$orgSlug/leagues/')({
  loader: ({ params }) => loadLeaguesFn({ data: params.orgSlug }),
  errorComponent: HttpErrorView,
  component: AdminLeaguesPage,
});

const adminRoute = getRouteApi('/admin');

function AdminLeaguesPage() {
  const { org } = Route.useRouteContext();
  const leagues = Route.useLoaderData();
  const { badges } = adminRoute.useLoaderData();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [result, setResult] = useState<ActionResult | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const isOwner = org.role === 'Owner';

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-2">
        <div>
          {/* level 1 — the sidebar link shares this accessible name. */}
          <h1 className="text-2xl font-bold tracking-tight">Leagues</h1>
          <p className="text-sm text-muted-foreground">
            Manage every league in {org.name}.
          </p>
        </div>
        {isOwner && (
          <Button
            variant={showCreate ? 'ghost' : 'default'}
            onClick={() => setShowCreate((open) => !open)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {showCreate ? 'Cancel' : 'New league'}
          </Button>
        )}
      </div>

      {result?.error && <Alert variant="destructive">{result.error}</Alert>}
      {result?.success && <Alert variant="success">{result.success}</Alert>}

      {showCreate && isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>New league</CardTitle>
            <CardDescription>
              Slug appears in URLs and cannot be changed easily later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                let actionResult: ActionResult;
                try {
                  actionResult = await createLeagueFn({
                    data: {
                      orgSlug: org.slug,
                      name: String(formData.get('name') ?? ''),
                      slug: String(formData.get('slug') ?? ''),
                      teamSize: String(formData.get('teamSize') ?? ''),
                      winningScore: String(formData.get('winningScore') ?? ''),
                    },
                  });
                } catch {
                  actionResult = {
                    error: 'Request failed. Please try again.',
                  };
                }
                setResult(actionResult);
                if (actionResult.success) {
                  await refreshAuthedShellData(queryClient);
                  await router.invalidate({ sync: true });
                }
                if (actionResult.success) setShowCreate(false);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required pattern="[a-z0-9-]+" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamSize">Format</Label>
                <select
                  id="teamSize"
                  name="teamSize"
                  defaultValue="2"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="2">2v2</option>
                  <option value="1">1v1</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="winningScore">Winning score</Label>
                <Input
                  id="winningScore"
                  name="winningScore"
                  type="number"
                  min="1"
                  placeholder="e.g. 10 (blank = free-form)"
                  defaultValue="10"
                />
              </div>
              <div className="sm:col-span-4">
                <Button type="submit">Create league</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {leagues.map((league) => (
          <Link
            key={league.id}
            to="/admin/$orgSlug/leagues/$leagueSlug"
            params={{ orgSlug: org.slug, leagueSlug: league.slug }}
            className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{league.name}</div>
                <p className="text-xs text-muted-foreground">{league.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <OpenFlagBadge count={openFlagsForLeague(badges, league.id)} />
              <Badge variant="outline">
                {formatLeagueFormat(league.teamSize)}
              </Badge>
            </div>
          </Link>
        ))}
        {leagues.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No leagues yet.
          </p>
        )}
      </div>
    </div>
  );
}
