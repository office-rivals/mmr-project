import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { DeviceAttentionChip, deviceProblems } from './device-health';
import type { BeamStatus, DeviceResponse } from './api';

const now = Date.parse('2026-10-16T12:00:00Z');
const device = (extra: Partial<DeviceResponse> = {}): DeviceResponse => ({
  id: '1',
  deviceId: 'fb-0123456789ab',
  claimed: true,
  role: 'Goal',
  tableId: 't1',
  lastSeenAt: '2026-10-16T11:00:00Z',
  lowBatt: false,
  ...extra,
});
const beam = (health: string) =>
  ({ health, mode: 'a', amb_ua: 0, lit1_ua: 70, margin: 6, checked_s: 0 }) as
    BeamStatus | never;
const kinds = (d: DeviceResponse) =>
  deviceProblems(d, now).map((p) => [p.text, p.severe]);

it('is quiet for a healthy, recently seen device', () => {
  expect(kinds(device({ lastStatus: { beam: beam('ok') } }))).toEqual([]);
  expect(kinds(device({ claimed: false, lowBatt: true }))).toEqual([]);
});

it('lists every problem, worst first', () => {
  expect(
    kinds(
      device({
        lowBatt: true,
        lastSeenAt: '2026-10-14T12:00:00Z',
        lastStatus: { reason: 'wrong_board' },
      })
    )
  ).toEqual([
    ['Wrong firmware', true],
    ['Silent for over 36 h', true],
    ['Battery low', false],
  ]);
  expect(kinds(device({ lastStatus: { reason: 'cutoff' } }))).toEqual([
    ['Battery empty', true],
  ]);
  expect(kinds(device({ lastSeenAt: null }))).toEqual([
    ['Silent for over 36 h', true],
  ]);
});

it('flags any beam state but OK, unknown ones as a warning', () => {
  expect(kinds(device({ lastStatus: { beam: beam('blocked') } }))).toEqual([
    ['Beam blocked', true],
  ]);
  expect(kinds(device({ lastStatus: { beam: beam('ambient_high') } }))).toEqual(
    [['Too much light', false]]
  );
  expect(kinds(device({ lastStatus: { beam: beam('new_state') } }))).toEqual([
    ['Beam: new_state', false],
  ]);
});

it('counts the devices that need attention on a table', () => {
  // The chip checks against the real clock: seen just now.
  const seen = (extra: Partial<DeviceResponse> = {}) =>
    device({ lastSeenAt: new Date().toISOString(), ...extra });
  const html = (devices: DeviceResponse[]) =>
    renderToStaticMarkup(<DeviceAttentionChip devices={devices} />);
  expect(html([seen()])).toBe('');
  expect(
    html([seen({ lowBatt: true }), seen({ lowBatt: true }), seen()])
  ).toContain('2 devices need attention');
});
