import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { BatteryWarning, Check, Copy, Plus, RotateCcw } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { HttpErrorView } from '@/components/http-error-view';
import {
  BeamConfigForm,
  BeamHealthBadge,
  ambientPanelUrl,
} from '@/features/foosball/beam';
import {
  DeviceAttentionChip,
  DeviceProblemChip,
  deviceProblems,
} from '@/features/foosball/device-health';
import { LastSeen } from '@/features/foosball/last-seen';
import { OccupancyBadge } from '@/features/foosball/occupancy';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { SOUND_VOLUMES } from '@/features/foosball/api';
import { formatVolts } from '@/features/foosball/format';
import { failServerAction } from '@/lib/server/action-result';
import { requireAdminOrg } from '@/lib/server/admin';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import type { LeagueResponse } from '@/api-v3';
import type {
  BeamConfig,
  DeviceResponse,
  DeviceRole,
  FoosballApi,
  AdminPlayerCardResponse,
  OrphanGoalResponse,
  SoundVolume,
  TableEnd,
  TableMatchResponse,
  TableResponse,
  UpsertTableRequest,
} from '@/features/foosball/api';

type ActionResult = { error?: string; success?: string; token?: string };

/** An action's message, shown next to what caused it (announced). */
function ActionMessage({ result }: { result?: ActionResult | null }) {
  if (result?.error)
    return (
      <Alert variant="destructive" className="w-full">
        {result.error}
      </Alert>
    );
  if (!result?.success) return null;
  return (
    <Alert
      variant="success"
      role="status"
      aria-live="polite"
      className="w-full"
    >
      {result.success}
      {result.token && (
        <code className="mt-2 block font-mono break-all">{result.token}</code>
      )}
    </Alert>
  );
}

const loadHardwareFn = createServerFn({ method: 'GET' })
  .validator((orgSlug: string) => orgSlug)
  .handler(async ({ data: orgSlug }) => {
    const org = await requireAdminOrg(orgSlug);
    const { foosballApi: api, leaguesApi } = await requireApiClientV3();
    const [tables, devices, leagues, claimable, orphans, cards, token] =
      await Promise.all([
        api.listTables(org.id),
        api.listDevices(org.id),
        leaguesApi.listLeagues(org.id),
        api.listClaimable(org.id),
        api.listOrphanGoals(org.id),
        api.listCards(org.id),
        org.role === 'Owner' ? api.getEnrolmentToken(org.id) : null,
      ]);
    // Deployment-specific (no hostnames in the repo); unset hides the link.
    const grafanaUrl = process.env.GRAFANA_URL?.replace(/\/$/, '') || null;
    return {
      tables,
      devices,
      leagues,
      claimable,
      orphans,
      cards,
      token,
      grafanaUrl,
    };
  });

/** Every mutation re-derives the org from the slug the caller administers. */
async function adminAction(
  orgSlug: string,
  success: string,
  run: (api: FoosballApi, orgId: string) => Promise<unknown>,
  /** Shown instead of the API's message on a 409. */
  conflict?: string
): Promise<ActionResult> {
  const org = await requireAdminOrg(orgSlug);
  const { foosballApi: api } = await requireApiClientV3();
  try {
    const result = await run(api, org.id);
    return { success, ...(result as { token?: string }) };
  } catch (err) {
    const { status, message } = await getApiErrorDetails(err, 'Request failed');
    return failServerAction(status, {
      error: status === 409 && conflict ? conflict : message,
    });
  }
}

const saveTableFn = createServerFn({ method: 'POST' })
  .validator(
    (input: { orgSlug: string; tableId?: string } & UpsertTableRequest) => input
  )
  .handler(({ data: { orgSlug, tableId, ...table } }) => {
    if (!table.name.trim())
      return failServerAction(400, { error: 'Name is required' });
    return adminAction(
      orgSlug,
      'Table saved',
      (api, orgId) =>
        tableId
          ? api.updateTable(orgId, tableId, table)
          : api.createTable(orgId, table),
      // The API's 409: a new league while a game is live or unclaimed.
      'Finish or discard the current game first, then change the league.'
    );
  });

const deleteTableFn = createServerFn({ method: 'POST' })
  .validator((input: { orgSlug: string; tableId: string }) => input)
  .handler(({ data }) =>
    adminAction(data.orgSlug, 'Table deleted', (api, orgId) =>
      api.deleteTable(orgId, data.tableId)
    )
  );

/** A readable table link code an admin picks, e.g. `table1`. */
const CUSTOM_CODE = /^[a-z0-9-]{3,32}$/;

const regenerateShortCodeFn = createServerFn({ method: 'POST' })
  .validator(
    (input: { orgSlug: string; tableId: string; code?: string }) => input
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const code = data.code?.trim().toLowerCase() || undefined;
    if (code && !CUSTOM_CODE.test(code))
      return failServerAction(400, {
        error:
          'Use 3–32 lowercase letters, digits or dashes for the link code.',
      });
    const org = await requireAdminOrg(data.orgSlug);
    const { foosballApi: api } = await requireApiClientV3();
    try {
      await api.regenerateShortCode(org.id, data.tableId, code);
      return {
        success:
          'New table link. Re-write the NFC sticker: the old link no longer works.',
      };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Request failed'
      );
      return failServerAction(status, {
        error:
          status === 409
            ? `The link code '${code}' is already taken. Pick another.`
            : message,
      });
    }
  });

const assignDeviceFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      orgSlug: string;
      deviceId: string;
      tableId: string;
      role: DeviceRole;
      end: TableEnd;
      conflict?: string;
    }) => input
  )
  .handler(({ data: { orgSlug, deviceId, tableId, role, end, conflict } }) =>
    adminAction(
      orgSlug,
      `${deviceId} assigned`,
      (api, orgId) => api.assignDevice(orgId, deviceId, { tableId, role, end }),
      conflict
    )
  );

const resetDeviceFn = createServerFn({ method: 'POST' })
  .validator((input: { orgSlug: string; deviceId: string }) => input)
  .handler(({ data }) =>
    adminAction(
      data.orgSlug,
      `${data.deviceId} reset — it is unclaimed again`,
      (api, orgId) => api.resetDevice(orgId, data.deviceId)
    )
  );

const beamConfigFn = createServerFn({ method: 'POST' })
  .validator(
    (input: { orgSlug: string; deviceId: string; config: BeamConfig }) => input
  )
  .handler(({ data }) =>
    adminAction(
      data.orgSlug,
      `${data.deviceId} beam settings saved — they apply at its next wake`,
      (api, orgId) => api.setBeamConfig(orgId, data.deviceId, data.config)
    )
  );

const deleteCardFn = createServerFn({ method: 'POST' })
  .validator((input: { orgSlug: string; cardId: string }) => input)
  .handler(({ data }) =>
    adminAction(data.orgSlug, 'Badge removed', (api, orgId) =>
      api.deleteCard(orgId, data.cardId)
    )
  );

const deleteAllCardsFn = createServerFn({ method: 'POST' })
  .validator((orgSlug: string) => orgSlug)
  .handler(async ({ data: orgSlug }) => {
    const org = await requireAdminOrg(orgSlug);
    if (org.role !== 'Owner')
      return failServerAction(403, {
        error: 'Only owners can delete all badges',
      });
    return adminAction(orgSlug, 'All badges deleted', (api, orgId) =>
      api.deleteAllCards(orgId)
    );
  });

const enrolmentTokenFn = createServerFn({ method: 'POST' })
  .validator((input: { orgSlug: string; revoke: boolean }) => input)
  .handler(async ({ data: { orgSlug, revoke } }) => {
    const org = await requireAdminOrg(orgSlug);
    if (org.role !== 'Owner')
      return failServerAction(403, {
        error: 'Only owners can manage the enrolment token',
      });
    return revoke
      ? adminAction(orgSlug, 'Enrolment token revoked', (api, orgId) =>
          api.revokeEnrolmentToken(orgId)
        )
      : adminAction(
          orgSlug,
          'New enrolment token. Copy it now: it is shown only once.',
          (api, orgId) => api.rotateEnrolmentToken(orgId)
        );
  });

export const Route = createFileRoute('/admin/$orgSlug/hardware')({
  loader: ({ params }) => loadHardwareFn({ data: params.orgSlug }),
  errorComponent: HttpErrorView,
  component: AdminHardwarePage,
});

const leagueName = (leagues: LeagueResponse[], table: TableResponse) =>
  leagues.find((l) => l.id === table.leagueId)?.name ?? 'Unknown league';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function AdminHardwarePage() {
  const { org } = Route.useRouteContext();
  const {
    tables,
    devices,
    leagues,
    claimable,
    orphans,
    cards,
    token,
    grafanaUrl,
  } = Route.useLoaderData();
  const router = useRouter();
  const [result, setResult] = useState<
    (ActionResult & { scope: string }) | null
  >(null);
  const [showCreate, setShowCreate] = useState(false);

  /**
   * `scope` names where the message shows: the card or device that caused
   * it. A device's scope follows it between the unclaimed list and its table;
   * `successScope` is for an action whose card goes away (create, delete).
   */
  const act = async (
    scope: string,
    call: () => Promise<ActionResult>,
    successScope = scope
  ) => {
    let actionResult: ActionResult;
    try {
      actionResult = await call();
    } catch {
      actionResult = { error: 'Request failed. Please try again.' };
    }
    if (actionResult.success) await router.invalidate({ sync: true });
    setResult({
      ...actionResult,
      scope: actionResult.success ? successScope : scope,
    });
    return actionResult;
  };
  const message = (scope: string) => (
    <ActionMessage result={result?.scope === scope ? result : null} />
  );

  // Freshly woken devices first: a goal counter has no screen, so "the one
  // that just checked in" is how an admin finds it.
  const unclaimed = devices
    .filter((d) => !d.claimed)
    .sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hardware</h1>
          <p className="text-sm text-muted-foreground">
            Foosball tables, goal counters and scoreboards in {org.name}.
          </p>
        </div>
        <Button
          variant={showCreate ? 'ghost' : 'default'}
          onClick={() => setShowCreate((open) => !open)}
        >
          <Plus className="mr-2 h-4 w-4" />
          {showCreate ? 'Cancel' : 'New table'}
        </Button>
      </div>

      {message('page')}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New table</CardTitle>
          </CardHeader>
          <CardContent>
            <TableForm
              leagues={leagues}
              submitLabel="Create table"
              onSubmit={async (table) => {
                const r = await act(
                  'new-table',
                  () => saveTableFn({ data: { orgSlug: org.slug, ...table } }),
                  'page'
                );
                if (r.success) setShowCreate(false);
              }}
            />
            {message('new-table')}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Unclaimed devices</CardTitle>
          <CardDescription>
            A new scoreboard shows its ID on screen. Goal counters have no
            screen: the one that checked in most recently is at the top.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {unclaimed.map((device) => (
            <div key={device.deviceId} className="space-y-2">
              <DeviceRow
                device={device}
                tables={tables}
                leagues={leagues}
                onAssign={(a) =>
                  act(`device:${device.deviceId}`, () =>
                    assignDeviceFn({
                      data: {
                        orgSlug: org.slug,
                        deviceId: device.deviceId,
                        ...a,
                      },
                    })
                  )
                }
              />
              {message(`device:${device.deviceId}`)}
            </div>
          ))}
          {unclaimed.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No unclaimed devices. Power one on near the table to enrol it.
            </p>
          )}
        </CardContent>
      </Card>

      {tables.map((table) => (
        <TableCard
          key={table.id}
          table={table}
          leagues={leagues}
          devices={devices.filter((d) => d.claimed && d.tableId === table.id)}
          grafanaUrl={grafanaUrl}
          unclaimedMatches={claimable.filter((m) => m.tableId === table.id)}
          message={message}
          onSave={(t) =>
            act(`table:${table.id}`, () =>
              saveTableFn({
                data: { orgSlug: org.slug, tableId: table.id, ...t },
              })
            )
          }
          onNewLink={(code) =>
            act(`table:${table.id}`, () =>
              regenerateShortCodeFn({
                data: { orgSlug: org.slug, tableId: table.id, code },
              })
            )
          }
          onDelete={() =>
            act(
              `table:${table.id}`,
              () =>
                deleteTableFn({
                  data: { orgSlug: org.slug, tableId: table.id },
                }),
              'page'
            )
          }
          onReset={(deviceId) =>
            act(`device:${deviceId}`, () =>
              resetDeviceFn({ data: { orgSlug: org.slug, deviceId } })
            )
          }
          onBeamConfig={(deviceId, config) =>
            act(`device:${deviceId}`, () =>
              beamConfigFn({ data: { orgSlug: org.slug, deviceId, config } })
            )
          }
        />
      ))}
      {tables.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No tables yet.
        </p>
      )}

      {orphans.length > 0 && <OrphanGoals orphans={orphans} tables={tables} />}

      <Badges
        cards={cards}
        isOwner={org.role === 'Owner'}
        message={message('badges')}
        onDelete={(cardId) =>
          act('badges', () =>
            deleteCardFn({ data: { orgSlug: org.slug, cardId } })
          )
        }
        onDeleteAll={() =>
          act('badges', () => deleteAllCardsFn({ data: org.slug }))
        }
      />

      {org.role === 'Owner' && (
        <Card>
          <CardHeader>
            <CardTitle>Enrolment token</CardTitle>
            <CardDescription>
              Devices use this token once to enrol into {org.name}. Replacing or
              revoking it stops new devices enrolling with the old one; enrolled
              devices keep working.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {token?.exists ? (
                <>
                  Created <LastSeen at={token.createdAt ?? null} />
                </>
              ) : (
                'No token: new devices cannot enrol.'
              )}
            </span>
            <Button
              variant="outline"
              onClick={() =>
                act('token', () =>
                  enrolmentTokenFn({
                    data: { orgSlug: org.slug, revoke: false },
                  })
                )
              }
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {token?.exists ? 'Replace token' : 'Create token'}
            </Button>
            {token?.exists && (
              <Button
                variant="ghost"
                onClick={() =>
                  act('token', () =>
                    enrolmentTokenFn({
                      data: { orgSlug: org.slug, revoke: true },
                    })
                  )
                }
              >
                Revoke
              </Button>
            )}
            {message('token')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TableForm({
  table: latest,
  leagues,
  submitLabel,
  onSubmit,
}: {
  table?: TableResponse;
  leagues: LeagueResponse[];
  submitLabel: string;
  onSubmit: (table: UpsertTableRequest) => void;
}) {
  // The values it opened with: a save reloads the page data while the form
  // is still open, and an uncontrolled field must keep its default.
  const [table] = useState(latest);
  const id = table?.id ?? 'new';
  const [namesClash, setNamesClash] = useState(false);
  return (
    <form
      className="grid gap-4 sm:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        const endLabelA = String(f.get('endLabelA') ?? '').trim() || 'Red';
        const endLabelB = String(f.get('endLabelB') ?? '').trim() || 'White';
        const clash = endLabelA.toLowerCase() === endLabelB.toLowerCase();
        setNamesClash(clash);
        if (clash) return;
        onSubmit({
          name: String(f.get('name') ?? '').trim(),
          leagueId: String(f.get('leagueId') ?? ''),
          endLabelA,
          endLabelB,
          soundVolume: Number(f.get('soundVolume') ?? 2) as SoundVolume,
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`name-${id}`}>Name</Label>
        <Input
          id={`name-${id}`}
          name="name"
          required
          defaultValue={table?.name}
        />
      </div>
      <div className="space-y-2">
        {/* The table, its devices and its games belong to this league. */}
        <Label htmlFor={`league-${id}`}>League</Label>
        <select
          id={`league-${id}`}
          name="leagueId"
          required
          defaultValue={table?.leagueId ?? ''}
          className={selectClass}
        >
          <option value="" disabled>
            Choose a league
          </option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {table && (
          <p className="text-xs text-muted-foreground">
            Changes only while no game is live or waiting to be claimed. Saved
            matches stay in their league.
          </p>
        )}
      </div>
      <fieldset className="grid gap-x-4 gap-y-2 sm:col-span-2 sm:grid-cols-2">
        <legend className="text-sm font-medium">Team names</legend>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          What players call the two teams when nobody's signed in: usually the
          colour of the figures.
        </p>
        <div className="space-y-2">
          <Label htmlFor={`endA-${id}`}>First team</Label>
          <Input
            id={`endA-${id}`}
            name="endLabelA"
            maxLength={12}
            placeholder="Red"
            defaultValue={table?.endLabelA ?? 'Red'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`endB-${id}`}>Second team</Label>
          <Input
            id={`endB-${id}`}
            name="endLabelB"
            maxLength={12}
            placeholder="White"
            defaultValue={table?.endLabelB ?? 'White'}
          />
        </div>
        {namesClash && (
          <p className="text-sm text-destructive sm:col-span-2" role="alert">
            The two teams need different names.
          </p>
        )}
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor={`sound-${id}`}>Table sound</Label>
        <select
          id={`sound-${id}`}
          name="soundVolume"
          defaultValue={table?.soundVolume ?? 2}
          className={selectClass}
        >
          {SOUND_VOLUMES.map((label, level) => (
            <option key={level} value={level}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-4">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

function TableCard({
  table,
  leagues,
  devices,
  unclaimedMatches,
  onSave,
  onNewLink,
  onDelete,
  onReset,
  onBeamConfig,
  grafanaUrl,
  message,
}: {
  table: TableResponse;
  leagues: LeagueResponse[];
  devices: DeviceResponse[];
  unclaimedMatches: TableMatchResponse[];
  onSave: (table: UpsertTableRequest) => Promise<ActionResult>;
  /** No code: a random one. */
  onNewLink: (code?: string) => Promise<ActionResult>;
  onDelete: () => void;
  onReset: (deviceId: string) => void;
  onBeamConfig: (deviceId: string, config: BeamConfig) => Promise<ActionResult>;
  grafanaUrl: string | null;
  /** The message of an action on this table (`table:<id>`) or a device. */
  message: (scope: string) => ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [beamFor, setBeamFor] = useState<string | null>(null);
  const [confirmNewLink, setConfirmNewLink] = useState(false);
  const [copied, setCopied] = useState(false);
  // The NFC sticker's link; the host comes from the page at runtime because
  // it is deployment-specific (empty until hydrated).
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/t/${table.shortCode}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert(`Table link: ${url}`);
    }
  };
  const endLabel = (end: TableEnd | null) =>
    end === 'A' ? table.endLabelA : end === 'B' ? table.endLabelB : '';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {table.name}
            <OccupancyBadge table={table} />
            <DeviceAttentionChip devices={devices} />
          </CardTitle>
          <CardDescription>
            {leagueName(leagues, table)} · Teams: {table.endLabelA} ·{' '}
            {table.endLabelB}
            {table.soundVolume != null &&
              ` · Sound ${SOUND_VOLUMES[table.soundVolume].toLowerCase()}`}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          {editing && (
            <Button variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {table.shortCode && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">NFC link:</span>
            <code className="min-w-0 truncate font-mono">{url}</code>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Copy table link"
              onClick={copyLink}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            {/* Two-step: a new link breaks the sticker already on the table. */}
            {confirmNewLink ? (
              <form
                className="flex w-full flex-wrap items-center gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const code = String(
                    new FormData(event.currentTarget).get('code') ?? ''
                  ).trim();
                  if ((await onNewLink(code || undefined)).success)
                    setConfirmNewLink(false);
                }}
              >
                <Label htmlFor={`code-${table.id}`} className="sr-only">
                  Link code
                </Label>
                <Input
                  id={`code-${table.id}`}
                  name="code"
                  placeholder="e.g. table1 (empty: random)"
                  pattern="[a-z0-9\-]{3,32}"
                  title="3–32 lowercase letters, digits or dashes"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => {
                    e.target.value = e.target.value.toLowerCase();
                  }}
                  className="h-9 w-56"
                />
                <Button type="submit" variant="destructive" size="sm">
                  Make new link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmNewLink(false)}
                >
                  Cancel
                </Button>
                <span className="w-full text-destructive">
                  The current sticker stops working.
                </span>
              </form>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmNewLink(true)}
              >
                New link
              </Button>
            )}
          </div>
        )}
        {editing && (
          <TableForm
            table={table}
            leagues={leagues}
            submitLabel="Save table"
            onSubmit={async (t) => {
              if ((await onSave(t)).success) setEditing(false);
            }}
          />
        )}
        {/* Under the link and the form: where Save and New link are. */}
        {message(`table:${table.id}`)}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Devices</h3>
          {devices.map((d) => (
            <div
              key={d.deviceId}
              id={`device-${d.deviceId}`}
              className="flex scroll-mt-20 flex-wrap items-center gap-x-4 gap-y-1 rounded-md border p-3 text-sm target:ring-2 target:ring-ring"
            >
              <code className="font-mono">{d.deviceId}</code>
              {deviceProblems(d)
                .filter((p) => p.kind !== 'beam')
                .map((p) => (
                  <DeviceProblemChip key={p.kind} problem={p} />
                ))}
              <Badge variant="outline">
                {/* One flex item, so a wrapped label flows as text. */}
                <span>
                  {d.role === 'Goal'
                    ? `${table.name} · guarded by ${endLabel(d.end ?? null)} · counts for ${endLabel(d.end === 'A' ? 'B' : 'A')}`
                    : `Scoreboard · ${endLabel(d.end ?? null)} end`}
                  {/* The counter's debug screen says "End A": match it here. */}
                  {d.role === 'Goal' && d.end && (
                    <span className="text-muted-foreground">
                      {' '}
                      · end {d.end}
                    </span>
                  )}
                </span>
              </Badge>
              <span className="flex items-center gap-1">
                {d.lowBatt && (
                  <BatteryWarning
                    className="h-4 w-4 text-destructive"
                    aria-label="Low battery"
                  />
                )}
                {formatVolts(d.batteryMv)}
              </span>
              <span className="text-muted-foreground">
                Seen <LastSeen at={d.lastSeenAt} />
              </span>
              <span className="text-muted-foreground">
                fw {d.firmwareVersion ?? '—'}
              </span>
              <span className="ml-auto flex gap-1">
                {d.role === 'Goal' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setBeamFor(beamFor === d.deviceId ? null : d.deviceId)
                    }
                  >
                    Beam settings
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReset(d.deviceId)}
                >
                  Reset
                </Button>
              </span>
              <BeamHealthBadge
                beam={d.lastStatus?.beam}
                statusAt={d.lastStatusAt}
              />
              {grafanaUrl && d.role === 'Goal' && (
                <a
                  href={ambientPanelUrl(grafanaUrl, d.deviceId)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  Light by hour of day
                </a>
              )}
              {beamFor === d.deviceId && (
                <BeamConfigForm
                  id={d.deviceId}
                  config={d.beamConfig}
                  onCancel={() => setBeamFor(null)}
                  onSave={async (config) => {
                    if ((await onBeamConfig(d.deviceId, config)).success)
                      setBeamFor(null);
                  }}
                />
              )}
              {message(`device:${d.deviceId}`)}
            </div>
          ))}
          {devices.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No devices assigned.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Unclaimed matches</h3>
          {unclaimedMatches.map((m) => (
            <div key={m.id} className="rounded-md border p-3 text-sm">
              {table.endLabelA} <strong>{m.scoreA}</strong> –{' '}
              <strong>{m.scoreB}</strong> {table.endLabelB}
              <span className="ml-3 text-muted-foreground">
                <LastSeen at={m.endedAt ?? m.startedAt} />
              </span>
            </div>
          ))}
          {unclaimedMatches.length === 0 && (
            <p className="text-sm text-muted-foreground">None waiting.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeviceRow({
  device,
  tables,
  leagues,
  onAssign,
}: {
  device: DeviceResponse;
  tables: TableResponse[];
  leagues: LeagueResponse[];
  onAssign: (assignment: {
    tableId: string;
    role: DeviceRole;
    end: TableEnd;
    conflict?: string;
  }) => void;
}) {
  const [role, setRole] = useState<DeviceRole>('Goal');
  const [tableId, setTableId] = useState(tables[0]?.id ?? '');
  const [end, setEnd] = useState<TableEnd>('A');
  const table = tables.find((t) => t.id === tableId);
  const id = device.deviceId;
  const team = (e: TableEnd) =>
    (e === 'A' ? table?.endLabelA : table?.endLabelB) ?? e;
  const other: TableEnd = end === 'A' ? 'B' : 'A';
  return (
    <form
      className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-5"
      onSubmit={(event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        onAssign({
          tableId,
          role,
          end: role === 'Goal' ? end : (String(f.get('end')) as TableEnd),
          // The API's 409: the other counter at this table has this end.
          conflict:
            role === 'Goal'
              ? `The other goal counter at ${table?.name} is already guarded by ${team(end)}. Set it to ${team(other)} first.`
              : undefined,
        });
      }}
    >
      <div className="text-sm">
        <code className="block font-mono">{id}</code>
        <span className="text-muted-foreground">
          <LastSeen at={device.lastSeenAt} /> · {formatVolts(device.batteryMv)}
        </span>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`table-${id}`}>Table</Label>
        <select
          id={`table-${id}`}
          value={tableId}
          onChange={(e) => setTableId(e.target.value)}
          required
          className={selectClass}
        >
          {/* A device joins its table's league. */}
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {leagues.length > 1
                ? `${t.name} (${leagueName(leagues, t)})`
                : t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`role-${id}`}>Role</Label>
        <select
          id={`role-${id}`}
          value={role}
          onChange={(e) => setRole(e.target.value as DeviceRole)}
          className={selectClass}
        >
          <option value="Goal">Goal counter</option>
          <option value="Scoreboard">Scoreboard</option>
        </select>
      </div>
      {role === 'Goal' ? (
        // A counter's end is the team whose goalkeeper guards it (ux A7).
        <div className="space-y-1 text-sm">
          <p id={`guard-${id}`} className="font-medium">
            Whose goalkeeper guards this goal?
          </p>
          {/* As the winner step: pressing the picked team again changes nothing. */}
          <ToggleGroup
            aria-labelledby={`guard-${id}`}
            value={[end]}
            onValueChange={([next]) => next && setEnd(next as TableEnd)}
            className="gap-2"
          >
            {(['A', 'B'] as const).map((e) => (
              <ToggleGroupItem key={e} value={e} className="h-10 flex-1 px-3">
                {team(e)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-muted-foreground" aria-live="polite">
            A ball in this goal is a goal for {team(other)}.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <Label htmlFor={`end-${id}`}>End it sits on</Label>
          <select id={`end-${id}`} name="end" className={selectClass}>
            <option value="A">{table?.endLabelA}</option>
            <option value="B">{table?.endLabelB}</option>
          </select>
        </div>
      )}
      <Button type="submit" disabled={tables.length === 0}>
        Claim
      </Button>
    </form>
  );
}

const ORPHAN_REASONS: Record<OrphanGoalResponse['reason'], string> = {
  UnassignedDevice: 'Device not assigned to a table',
  OtherTable: 'Device sent a goal for another table',
  NoMatch: 'Arrived late and fits no game',
};

/** Goals the API kept but couldn't count: a sign of a misassigned device. */
function OrphanGoals({
  orphans,
  tables,
}: {
  orphans: OrphanGoalResponse[];
  tables: TableResponse[];
}) {
  const tableName = (id?: string | null) =>
    tables.find((t) => t.id === id)?.name ?? '—';
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unmatched goals</CardTitle>
        <CardDescription>
          Goals the server received but could not count towards any game. A
          steady stream usually means a device is assigned to the wrong table or
          not assigned at all.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <details>
          <summary className="cursor-pointer text-sm">
            {orphans.length === 200 ? 'Newest 200' : orphans.length} goals
          </summary>
          <ul className="mt-3 space-y-1 text-sm">
            {orphans.map((g) => (
              <li key={g.id} className="flex flex-wrap gap-x-3">
                <LastSeen at={g.receivedAt} />
                <code className="font-mono">{g.deviceId}</code>
                <span>{tableName(g.tableId)}</span>
                <span className="text-muted-foreground">
                  {ORPHAN_REASONS[g.reason] ?? g.reason}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

function Badges({
  cards,
  isOwner,
  message,
  onDelete,
  onDeleteAll,
}: {
  cards: AdminPlayerCardResponse[];
  isOwner: boolean;
  message: ReactNode;
  onDelete: (cardId: string) => void;
  onDeleteAll: () => void;
}) {
  const { formatDate } = useLocaleFormatters();
  const [confirmAll, setConfirmAll] = useState(false);
  const name = (c: AdminPlayerCardResponse) =>
    c.displayName ?? c.username ?? 'Unknown member';
  const sorted = [...cards].sort((a, b) => name(a).localeCompare(name(b)));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Badges</CardTitle>
        <CardDescription>
          Badges members linked to themselves to join games at a scoreboard.
          Only a keyed hash of each badge is stored. Remove a lost badge so it
          can&apos;t be used to play as its owner.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No badges linked.</p>
        ) : (
          <details>
            <summary className="cursor-pointer text-sm">
              {cards.length} {cards.length === 1 ? 'badge' : 'badges'}
            </summary>
            <ul className="mt-3 space-y-1 text-sm">
              {sorted.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span>{name(c)}</span>
                  {c.username && c.displayName && (
                    <span className="text-muted-foreground">@{c.username}</span>
                  )}
                  <span className="text-muted-foreground">
                    linked {formatDate(c.createdAt)}
                    {c.linkedBy &&
                      ` by ${c.linkedBy.displayName ?? c.linkedBy.username ?? 'someone else'}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => onDelete(c.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}
        {isOwner &&
          cards.length > 0 &&
          (confirmAll ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              Every member has to link their badge again.
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setConfirmAll(false);
                  onDeleteAll();
                }}
              >
                Delete all badges
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmAll(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmAll(true)}>
              Delete all badges
            </Button>
          ))}
        {message}
      </CardContent>
    </Card>
  );
}
