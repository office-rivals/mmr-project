import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { requireAdminOrg } from '@/lib/server/admin';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { cn } from '@/lib/utils';
import { BEAM_HEALTH } from './beam';
import { SILENT_AFTER_MS } from './format';
import type { DeviceResponse, TableResponse } from './api';

export interface DeviceProblem {
  kind: 'board' | 'battery' | 'silent' | 'beam';
  text: string;
  hint: string;
  /** Red: the device isn't counting (or can't be trusted to). */
  severe: boolean;
}

/** What needs an admin on a claimed device, worst first; [] when it's fine. */
export function deviceProblems(
  device: DeviceResponse,
  now = Date.now()
): DeviceProblem[] {
  if (!device.claimed) return [];
  const problems: DeviceProblem[] = [];
  const reason = device.lastStatus?.reason;
  if (reason === 'wrong_board')
    problems.push({
      kind: 'board',
      text: 'Wrong firmware',
      hint: 'Flash the image for this board (goal counter or scoreboard)',
      severe: true,
    });
  const seen = device.lastSeenAt ? Date.parse(device.lastSeenAt) : NaN;
  if (!(now - seen < SILENT_AFTER_MS))
    problems.push({
      kind: 'silent',
      text: 'Silent for over 36 h',
      hint: 'Check its batteries and the Wi-Fi',
      severe: true,
    });
  if (reason === 'cutoff')
    problems.push({
      kind: 'battery',
      text: 'Battery empty',
      hint: 'Replace the batteries',
      severe: true,
    });
  else if (device.lowBatt)
    problems.push({
      kind: 'battery',
      text: 'Battery low',
      hint: 'Replace the batteries soon',
      severe: false,
    });
  const beam = device.lastStatus?.beam;
  if (beam && beam.health !== 'ok') {
    // An unknown future state is a warning, never OK.
    const known = BEAM_HEALTH[beam.health];
    problems.push({
      kind: 'beam',
      text: known?.text ?? `Beam: ${beam.health}`,
      hint: known?.hint ?? 'See the device on the Hardware page',
      severe: beam.health === 'blocked' || beam.health === 'sensor_dead',
    });
  }
  return problems;
}

const tone = (severe: boolean) =>
  severe
    ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400';

/** "2 devices need attention" on a table; nothing when all are fine. */
export function DeviceAttentionChip({
  devices,
}: {
  devices: DeviceResponse[];
}) {
  const problems = devices.map((d) => deviceProblems(d));
  const count = problems.filter((p) => p.length > 0).length;
  if (count === 0) return null;
  const severe = problems.flat().some((p) => p.severe);
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 whitespace-nowrap', tone(severe))}
    >
      <TriangleAlert className="size-3" aria-hidden />
      {count === 1 ? '1 device needs' : `${count} devices need`} attention
    </Badge>
  );
}

/** One problem as a chip, for the device's own row. */
export function DeviceProblemChip({ problem }: { problem: DeviceProblem }) {
  return (
    <Badge
      variant="outline"
      className={cn('whitespace-nowrap', tone(problem.severe))}
      title={problem.hint}
    >
      {problem.text}
    </Badge>
  );
}

export interface DeviceAttention {
  device: DeviceResponse;
  table?: TableResponse;
  problems: DeviceProblem[];
}

export const listDeviceAttentionFn = createServerFn({ method: 'GET' })
  .validator((orgSlug: string) => orgSlug)
  .handler(async ({ data: orgSlug }): Promise<DeviceAttention[]> => {
    const org = await requireAdminOrg(orgSlug);
    const { foosballApi } = await requireApiClientV3();
    const [devices, tables] = await Promise.all([
      foosballApi.listDevices(org.id),
      foosballApi.listTables(org.id),
    ]);
    return devices
      .map((device) => ({
        device,
        table: tables.find((t) => t.id === device.tableId),
        problems: deviceProblems(device),
      }))
      .filter((a) => a.problems.length > 0);
  });

/**
 * Devices that need an admin, on the org admin page. Renders nothing while
 * loading or on any error, so the hardware API can't break the page.
 */
export function DeviceAttentionBanner({ orgSlug }: { orgSlug: string }) {
  const { data } = useQuery({
    queryKey: ['foosball-attention', orgSlug],
    queryFn: () => listDeviceAttentionFn({ data: orgSlug }),
    retry: false,
  });
  if (!data?.length) return null;
  const severe = data.some((a) => a.problems.some((p) => p.severe));
  return (
    <div
      className={cn('space-y-2 rounded-lg border p-3 text-sm', tone(severe))}
      data-testid="device-attention-banner"
    >
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4" aria-hidden />
        {data.length === 1
          ? '1 device needs'
          : `${data.length} devices need`}{' '}
        attention
      </p>
      <ul className="space-y-1">
        {data.map(({ device, table, problems }) => (
          <li key={device.deviceId}>
            <Link
              to="/admin/$orgSlug/hardware"
              params={{ orgSlug }}
              hash={`device-${device.deviceId}`}
              className="underline underline-offset-4"
            >
              {table ? `${table.name}, ` : ''}
              {device.role === 'Goal' ? 'goal counter' : 'scoreboard'}{' '}
              <code className="font-mono">{device.deviceId}</code>
            </Link>
            : {problems.map((p) => `${p.text} (${p.hint})`).join('; ')}
          </li>
        ))}
      </ul>
    </div>
  );
}
