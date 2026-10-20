import { Badge } from '@/components/ui/badge';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { cn } from '@/lib/utils';
import { columns, scoreOf } from './live';
import type { TableOccupancy, TableResponse } from './api';

/**
 * The badge text per state, as in analytics/METRICS.md §8.2. The score is in
 * the table's column order, like the live score next to it.
 */
export function occupancyText(
  o: TableOccupancy,
  formatTime: (iso: string) => string,
  table?: TableResponse
) {
  const since = o.since ? ` since ${formatTime(o.since)}` : '';
  const score =
    o.scoreA != null && o.scoreB != null
      ? (table ? columns(table) : (['A', 'B'] as const))
          .map((end) => scoreOf({ scoreA: o.scoreA!, scoreB: o.scoreB! }, end))
          .join('–')
      : null;
  switch (o.status) {
    case 'InUse':
      if (o.reason === 'Gathering' && o.rosterCount != null && o.rosterSize)
        return `Gathering: ${o.rosterCount} of ${o.rosterSize}`;
      if (o.reason === 'TeamsMade') return 'Teams made';
      return `In use${since}${score ? ` · ${score}` : ''}`;
    case 'ProbablyInUse':
      return `Probably in use${since}${score ? ` · ${score}` : ''}`;
    case 'JustFinished':
      return `Just finished${score ? ` ${score}` : ''} · free soon`;
    case 'Free':
      return 'Free';
    default:
      // Unknown, or a state this app doesn't know yet: never claim Free.
      return `Status unknown${UNKNOWN_HINTS[o.reason ?? ''] ?? ''}`;
  }
}

const UNKNOWN_HINTS: Record<string, string> = {
  NoDevices: ' · no goal counter',
  LowBattery: ' · battery low',
  Offline: ' · devices offline',
};

const COLORS: Partial<Record<TableOccupancy['status'], string>> = {
  Free: 'border-green-500/30 bg-green-500/20 text-green-700 dark:text-green-400',
  InUse:
    'border-orange-500/30 bg-orange-500/20 text-orange-700 dark:text-orange-400',
  ProbablyInUse:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
};

export function OccupancyBadge({ table }: { table: TableResponse }) {
  const { formatTime } = useLocaleFormatters();
  const { occupancy } = table;
  // Older API responses have no occupancy yet.
  if (!occupancy) return null;
  const color = COLORS[occupancy.status];
  return (
    <Badge
      variant={color ? 'outline' : 'secondary'}
      className={cn('gap-1.5 whitespace-nowrap', color)}
    >
      {occupancy.status === 'Free' && occupancy.reason === 'Touched' && (
        <span
          className="size-1.5 rounded-full bg-current opacity-50"
          title="Someone's nearby"
          aria-label="Someone's nearby"
        />
      )}
      {occupancyText(occupancy, formatTime, table)}
    </Badge>
  );
}
