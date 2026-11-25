import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import {
  BeamConfigForm,
  BeamHealthBadge,
  ambientPanelUrl,
  beamReadings,
  parseBeamConfig,
} from './beam';
import type { BeamStatus } from './api';

const beam = (extra: Partial<BeamStatus> = {}): BeamStatus => ({
  health: 'ok',
  mode: 'a',
  amb_ua: 0.4,
  lit1_ua: 73.2,
  margin: 6.13,
  ball_ua: 1.234,
  checked_s: 40,
  ...extra,
});

it('lists the readings in µA with the mode', () => {
  expect(beamReadings(beam())).toBe(
    'lit 73 µA · ambient 0.4 µA · ball 1.23 µA · margin 6.1× · mode A'
  );
  expect(beamReadings(beam({ ball_ua: null, mode: 'a_boost' }))).toBe(
    'lit 73 µA · ambient 0.4 µA · margin 6.1× · mode A+'
  );
});

it('shows the state, what to do, and when it was checked', () => {
  const html = renderToStaticMarkup(
    <BeamHealthBadge
      beam={beam({ health: 'blocked' })}
      statusAt="2026-10-16T10:00:40Z"
    />
  );
  expect(html).toContain('Beam blocked');
  expect(html).toContain('Empty the drawer');
  expect(html).toContain('dateTime="2026-10-16T10:00:00.000Z"');
});

it('never shows an unknown state as OK, and nothing without a report', () => {
  const html = renderToStaticMarkup(
    <BeamHealthBadge beam={beam({ health: 'new_state' as never })} />
  );
  expect(html).toContain('Beam: new_state');
  expect(html).toContain('amber');
  expect(renderToStaticMarkup(<BeamHealthBadge beam={null} />)).toBe('');
});

it('sends only the filled-in fields, the LED pair together', () => {
  const form = new FormData();
  form.set('mode', 'B');
  form.set('marginMin', '2.5');
  form.set('checkS', '');
  form.set('ledMa1', '4.7');
  expect(parseBeamConfig(form)).toEqual({
    mode: 'B',
    marginMin: 2.5,
    ledMa: [1, 4.7],
  });
});

it('opens on the saved mode with its help, defaults as placeholders', () => {
  const html = renderToStaticMarkup(
    <BeamConfigForm
      id="fb-0123456789ab"
      config={{ mode: 'B', marginMin: 2.5 }}
      onSave={() => {}}
      onCancel={() => {}}
    />
  );
  expect(html).toContain('1.5–1.9 months');
  expect(html).toContain('placeholder="220000"');
  expect(html).toContain('value="2.5"');
});

it('links the ambient-by-hour panel for the device', () => {
  expect(ambientPanelUrl('https://grafana.example', 'fb-0123456789ab')).toBe(
    'https://grafana.example/d/foosball-device?var-device=fb-0123456789ab&viewPanel=panel-15'
  );
});
