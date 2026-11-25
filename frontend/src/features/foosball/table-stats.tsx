import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { WEEKDAYS, mmss, officeHoursText, percent, statText } from './stats';
import type { StatValue, TableResponse, TableStatsResponse } from './api';

/** The per-table stats page body; admin adds the moderator-only numbers. */
export function Stats({
  stats: s,
  table,
  admin,
}: {
  stats: TableStatsResponse;
  table: TableResponse;
  admin: boolean;
}) {
  const { formatDate } = useLocaleFormatters();
  const duration = s.matchDurationS;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Games" stat={s.games} format={String} />
        <Tile
          label="Games per week"
          stat={s.averageGamesPerWeek}
          format={(v) => v.toFixed(1)}
          unit="full weeks"
        />
        <Tile
          label="Typical game"
          stat={duration}
          format={mmss}
          unit="finished games"
          detail={
            duration.low != null &&
            duration.high != null &&
            `Most take ${mmss(duration.low)}–${mmss(duration.high)}`
          }
        />
        <Tile
          label="In use"
          stat={s.utilisation}
          format={(v) =>
            `${s.utilisationIsLowerBound ? '≥ ' : ''}${percent(v)}`
          }
          unit="full weeks"
          detail={`of office hours (${officeHoursText(s.officeHours)})`}
        />
      </div>

      <GamesPerDay days={s.gamesPerDay} />

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">Weeks</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Week of</TableHead>
              <TableHead className="text-right">Games</TableHead>
              <TableHead className="text-right">Unclaimed</TableHead>
              <TableHead className="text-right">In use</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...s.weeks].reverse().map((w) => (
              <TableRow key={w.weekStart}>
                <TableCell>
                  {formatDate(w.weekStart, '—', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  {!w.fullWeek && (
                    <span className="text-muted-foreground"> (part)</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {w.games}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {w.unclaimed}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {w.utilisation == null
                    ? '–'
                    : `${s.utilisationIsLowerBound ? '≥ ' : ''}${percent(w.utilisation)}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <BusyHours busy={s.busyHours} />

      {admin && <AdminStats stats={s} table={table} />}
    </>
  );
}

function Tile({
  label,
  stat,
  format,
  unit,
  detail,
}: {
  label: string;
  stat: StatValue;
  format: (value: number) => string;
  unit?: string;
  detail?: string | false;
}) {
  const { text, note } = statText(stat, format, unit);
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-card p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-2xl font-semibold tabular-nums ${note ? 'text-muted-foreground' : ''}`}
      >
        {text}
      </span>
      {detail && (
        <span className="text-xs text-muted-foreground">{detail}</span>
      )}
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

function GamesPerDay({ days }: { days: TableStatsResponse['gamesPerDay'] }) {
  const { formatDate } = useLocaleFormatters();
  const day = (date?: string) =>
    formatDate(date, '', { day: 'numeric', month: 'short' });
  const max = Math.max(1, ...days.map((d) => d.games));
  const total = days.reduce((sum, d) => sum + d.games, 0);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-2xl">Games per day</h2>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No games in this period.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`${total} games over ${days.length} days, at most ${max} a day`}
            className="flex h-32 items-end gap-px"
          >
            {days.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.games} games (${d.submitted} rated, ${d.unclaimed} unclaimed)`}
                className="flex min-w-0 flex-1 flex-col justify-end"
                style={{ height: `${(d.games / max) * 100}%` }}
              >
                <div
                  className="bg-primary/40"
                  style={{ flexGrow: d.unclaimed }}
                />
                <div className="bg-primary" style={{ flexGrow: d.submitted }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{day(days[0]?.date)}</span>
            <span className="flex gap-3">
              <span>
                <span className="mr-1 inline-block size-2 bg-primary" />
                Rated
              </span>
              <span>
                <span className="mr-1 inline-block size-2 bg-primary/40" />
                Unclaimed
              </span>
            </span>
            <span>{day(days[days.length - 1]?.date)}</span>
          </div>
        </>
      )}
    </section>
  );
}

function BusyHours({ busy }: { busy: TableStatsResponse['busyHours'] }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-2xl">Busiest hours</h2>
        <p className="text-sm text-muted-foreground">
          {busy.enough
            ? 'Darker means more minutes of play in that hour, on average.'
            : `Not enough data yet: ${busy.n} of ${busy.minN} games, ${Math.floor(busy.weeksOfData)} of 4 weeks. Try a longer period.`}
        </p>
      </div>
      <div
        className={`grid grid-cols-[2.25rem_repeat(24,minmax(0,1fr))] gap-px text-xs ${busy.enough ? '' : 'opacity-50'}`}
      >
        {busy.values.map((hours, day) => (
          <div key={day} className="contents">
            <span className="text-muted-foreground">{WEEKDAYS[day]}</span>
            {hours.map((minutes, hour) => (
              <div
                key={hour}
                title={`${WEEKDAYS[day]} ${String(hour).padStart(2, '0')}:00: ${Math.round(minutes)} min of play on average`}
                className="aspect-square rounded-sm bg-primary"
                style={{ opacity: 0.06 + 0.94 * Math.min(1, minutes / 60) }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="text-center text-muted-foreground">
            {hour % 6 === 0 ? hour : ''}
          </span>
        ))}
      </div>
    </section>
  );
}

function AdminStats({
  stats: s,
  table,
}: {
  stats: TableStatsResponse;
  table: TableResponse;
}) {
  const claim = statText(s.claimRate, percent);
  const bias = statText(s.endBias, percent);
  const q = s.dataQuality;
  const line = (stat: StatValue, format: (v: number) => string) =>
    statText(stat, format).text;
  return (
    <Card>
      <CardHeader>
        <CardTitle>For admins</CardTitle>
        <CardDescription>Only moderators and owners see this.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>
          <strong>Claimed:</strong> {claim.text} of finished games end up as
          rated matches (linked games {line(s.claimRateLinked, percent)}, others{' '}
          {line(s.claimRateUnlinked, percent)}).
          {claim.note && ` ${claim.note}.`}
        </p>
        <p>
          {/* endBias is the share credited to team A, whichever goal it hit. */}
          <strong>End bias:</strong> {bias.text} of goals are for{' '}
          {table.endLabelA}
          {s.endBias.low != null &&
            s.endBias.high != null &&
            ` (95% range ${percent(s.endBias.low)}–${percent(s.endBias.high)})`}
          . Far from 50% can mean a tilted table or a goal counter missing
          goals.{bias.note && ` ${bias.note}.`}
        </p>
        <p>
          <strong>Data quality:</strong> scorer picked on{' '}
          {line(q.scorerPickRate, percent)} of goals,{' '}
          {q.fragmentsPerWeek.toFixed(1)} unfinished starts and{' '}
          {q.discardedPerWeek.toFixed(1)} discarded games a week,{' '}
          {q.orphansOtherTable} goals from another table&apos;s device and{' '}
          {q.orphansNoMatch} with no game.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead className="text-right">Goals</TableHead>
              <TableHead className="text-right">Undone</TableHead>
              <TableHead className="text-right">Too fast</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.devices.map((d) => (
              <TableRow key={d.deviceId}>
                <TableCell>
                  <span className="font-mono whitespace-nowrap">
                    {d.deviceId}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    {d.role === 'Goal'
                      ? `guarded by ${d.end === 'A' ? table.endLabelA : d.end === 'B' ? table.endLabelB : '?'}`
                      : d.role === 'Scoreboard'
                        ? 'scoreboard'
                        : ''}
                    {d.lowBatt && ' · battery low'}
                    {d.out && ' · out'}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {d.goals}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {line(d.undoRate, percent)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {line(d.fastGapRate, percent)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
