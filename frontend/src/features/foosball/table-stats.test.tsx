import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Stats } from './table-stats';
import type { StatValue, TableResponse, TableStatsResponse } from './api';

const v = (value: number | null, enough = true, extra = {}): StatValue => ({
  value,
  n: enough ? 40 : 3,
  minN: 10,
  enough,
  ...extra,
});
const stats: TableStatsResponse = {
  tableId: 't1',
  from: '2026-08-20T00:00:00Z',
  to: '2026-10-15T00:00:00Z',
  timeZone: 'Europe/Copenhagen',
  officeHours: {
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    start: '08:00',
    end: '18:00',
  },
  games: v(42),
  averageGamesPerWeek: v(5.25),
  gamesPerDay: [
    { date: '2026-10-13', games: 3, submitted: 2, unclaimed: 1 },
    { date: '2026-10-14', games: 0, submitted: 0, unclaimed: 0 },
  ],
  weeks: [
    {
      weekStart: '2026-10-12',
      fullWeek: false,
      games: 3,
      submitted: 2,
      unclaimed: 1,
      utilisation: 0.1,
    },
  ],
  busyHours: {
    values: Array.from({ length: 7 }, () => Array<number>(24).fill(12)),
    unit: 'busy_minutes',
    n: 12,
    minN: 30,
    weeksOfData: 2.6,
    enough: false,
  },
  matchDurationS: v(270, true, { low: 200, high: 330 }),
  utilisation: v(0.234),
  utilisationIsLowerBound: true,
  claimRate: v(0.8),
  claimRateLinked: v(1),
  claimRateUnlinked: v(0.6, false),
  endBias: v(0.52, true, { low: 0.45, high: 0.59 }),
  dataQuality: {
    devices: [
      {
        deviceId: 'fb-0123456789ab',
        role: 'Goal',
        end: 'A',
        goals: 120,
        undoRate: v(0.05),
        fastGapRate: v(0.01),
        lowBatt: true,
        out: false,
      },
    ],
    orphansOtherTable: 0,
    orphansNoMatch: 2,
    fragmentsPerWeek: 1.5,
    discardedPerWeek: 0.5,
    scorerPickRate: v(0.3),
  },
};
const table = { endLabelA: 'Red', endLabelB: 'White' } as TableResponse;
const render = (admin: boolean) =>
  renderToStaticMarkup(<Stats stats={stats} table={table} admin={admin} />);

it('shows the player stats with units and small-sample notes', () => {
  const html = render(false);
  expect(html).toContain('5.3');
  expect(html).toContain('4:30');
  expect(html).toContain('Most take 3:20–5:30');
  expect(html).toContain('≥ 23%');
  expect(html).toContain('of office hours (Mon–Fri 08:00–18:00)');
  expect(html).toContain('Not enough data yet: 12 of 30 games, 2 of 4 weeks.');
  expect(html.match(/min of play on average/g)).toHaveLength(7 * 24);
  expect(html).not.toContain('For admins');
});

it('adds the admin numbers for moderators', () => {
  const html = render(true);
  expect(html).toContain('For admins');
  expect(html).toContain('52% of goals are for Red');
  expect(html).toContain('95% range 45%–59%');
  expect(html).toContain('guarded by Red · battery low');
  expect(html).toContain('1.5 unfinished starts and 0.5 discarded games');
});
