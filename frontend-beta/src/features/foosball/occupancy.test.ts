import { expect, it } from 'vitest';
import { occupancyText } from './occupancy';
import type { TableOccupancy, TableResponse } from './api';

const at = (extra: Partial<TableOccupancy>): TableOccupancy => ({
  status: 'InUse',
  since: '2026-10-15T10:42:00Z',
  reason: 'Game',
  scoreA: null,
  scoreB: null,
  rosterCount: null,
  rosterSize: null,
  ...extra,
});
const time = (iso: string) => iso.slice(11, 16);

it('describes each occupancy state', () => {
  expect(occupancyText(at({}), time)).toBe('In use since 10:42');
  expect(occupancyText(at({ scoreA: 3, scoreB: 2 }), time)).toBe(
    'In use since 10:42 · 3–2'
  );
  // In the table's column order, like the live score next to it.
  expect(
    occupancyText(at({ scoreA: 3, scoreB: 2 }), time, {
      scoreboardLeftEnd: 'B',
    } as TableResponse)
  ).toBe('In use since 10:42 · 2–3');
  expect(
    occupancyText(
      at({ reason: 'Gathering', rosterCount: 2, rosterSize: 4 }),
      time
    )
  ).toBe('Gathering: 2 of 4');
  expect(occupancyText(at({ reason: 'TeamsMade' }), time)).toBe('Teams made');
  expect(
    occupancyText(at({ status: 'ProbablyInUse', reason: 'LongPause' }), time)
  ).toBe('Probably in use since 10:42');
  expect(
    occupancyText(at({ status: 'JustFinished', scoreA: 10, scoreB: 7 }), time)
  ).toBe('Just finished 10–7 · free soon');
  expect(occupancyText(at({ status: 'Free', reason: 'Touched' }), time)).toBe(
    'Free'
  );
});

it('never shows an unknown or unexpected state as free', () => {
  const unknown = at({ status: 'Unknown', since: null, reason: null });
  expect(occupancyText(unknown, time)).toBe('Status unknown');
  expect(occupancyText({ ...unknown, reason: 'LowBattery' }, time)).toBe(
    'Status unknown · battery low'
  );
  expect(occupancyText({ ...unknown, reason: 'Offline' }, time)).toBe(
    'Status unknown · devices offline'
  );
  expect(occupancyText({ ...unknown, reason: 'NoDevices' }, time)).toBe(
    'Status unknown · no goal counter'
  );
  const future = at({ status: 'Offline' as TableOccupancy['status'] });
  expect(occupancyText(future, time)).toBe('Status unknown');
});
