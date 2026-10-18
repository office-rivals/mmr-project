import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { LastSeen } from './last-seen';
import type { BeamConfig, BeamHealth, BeamMode, BeamStatus } from './api';

/** firmware/beam-health-firmware-2026-10-16.md §4: what it means, what to do. */
export const BEAM_HEALTH: Record<BeamHealth, { text: string; hint?: string }> =
  {
    ok: { text: 'Beam OK' },
    low_margin: {
      text: 'Beam weak',
      hint: 'Clean or realign it, or fit the next LED resistor',
    },
    ambient_high: {
      text: 'Too much light',
      hint: 'Shade the drawer or receiver; balls may be missed',
    },
    blocked: {
      text: 'Beam blocked',
      hint: 'Empty the drawer; if it stays blocked, check the LED',
    },
    sensor_dead: {
      text: 'Beam sensor dead',
      hint: 'Check the receiver and its wiring',
    },
  };

const COLORS: Record<BeamHealth, string> = {
  ok: 'border-green-500/30 bg-green-500/20 text-green-700 dark:text-green-400',
  low_margin:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  ambient_high:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  blocked: 'border-destructive/30 bg-destructive/10 text-destructive',
  sensor_dead: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export const BEAM_MODES: Record<BeamMode, string> = {
  a: 'A (default)',
  a_boost: 'A+ (brighter LED)',
  b: 'B (daylight)',
  auto: 'Auto',
};

/** Observability's ambient-by-hour panel for one goal counter (INTERFACES §10). */
export const ambientPanelUrl = (grafanaUrl: string, deviceId: string) =>
  `${grafanaUrl}/d/foosball-device?var-device=${encodeURIComponent(deviceId)}&viewPanel=panel-15`;

const ua = (value: number) => `${+value.toFixed(value < 10 ? 2 : 0)} µA`;

/** "lit 73 µA · ambient 0.4 µA · ball 1.2 µA · margin 6.1× · mode A". */
export function beamReadings(beam: BeamStatus) {
  return [
    `lit ${ua(beam.lit1_ua)}`,
    `ambient ${ua(beam.amb_ua)}`,
    beam.ball_ua != null && `ball ${ua(beam.ball_ua)}`,
    `margin ${+beam.margin.toFixed(1)}×`,
    `mode ${BEAM_MODES[beam.mode]?.split(' ')[0] ?? beam.mode}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A goal counter's beam health; nothing for firmware without a beam report. */
export function BeamHealthBadge({
  beam,
  statusAt,
}: {
  beam?: BeamStatus | null;
  statusAt?: string | null;
}) {
  if (!beam) return null;
  // An unknown future state shows as a warning, never as OK.
  const health = BEAM_HEALTH[beam.health] ?? { text: `Beam: ${beam.health}` };
  const checkedAt =
    statusAt &&
    new Date(Date.parse(statusAt) - beam.checked_s * 1000).toISOString();
  return (
    <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
      <Badge
        variant="outline"
        className={cn(
          'whitespace-nowrap',
          COLORS[beam.health] ?? COLORS.low_margin
        )}
        title={health.hint}
      >
        {health.text}
      </Badge>
      {health.hint && <span>{health.hint}.</span>}
      <span className="text-muted-foreground">
        {beamReadings(beam)}
        {checkedAt && (
          <>
            {' '}
            · checked <LastSeen at={checkedAt} />
          </>
        )}
      </span>
    </span>
  );
}

type ConfigMode = NonNullable<BeamConfig['mode']>;

/** Electronics' modes (beam-health §3); battery figures are EST. */
const MODES: { value: ConfigMode; label: string; help: string }[] = [
  { value: 'A', label: 'A (default)', help: '1 mA LED, for a dark drawer.' },
  {
    value: 'ABoost',
    label: 'A+ (brighter LED)',
    help: 'Adds the 3.1 mA boost, for weak or misaligned optics.',
  },
  {
    value: 'B',
    label: 'B (daylight)',
    help: 'Tolerates about 11× the light, but costs battery: ≈ 1.5–1.9 months if on through all play (EST).',
  },
  {
    value: 'Auto',
    label: 'Auto',
    help: 'Switches between A, A+ and B on the measured light, with the thresholds below.',
  },
];

type NumberField = Exclude<keyof BeamConfig, 'mode' | 'ledMa'>;

/** Firmware defaults (§6) as placeholders; the browser enforces the ranges. */
const FIELDS: {
  key: NumberField;
  label: string;
  def: number;
  min: number;
  max: number;
  step?: number;
}[] = [
  {
    key: 'rPuAOhm',
    label: 'Fitted R_PU (Ω)',
    def: 220000,
    min: 1000,
    max: 1e7,
  },
  {
    key: 'rPuBOhm',
    label: 'Fitted R_PU_B (Ω)',
    def: 22000,
    min: 1000,
    max: 1e7,
  },
  {
    key: 'checkS',
    label: 'Check every (s, 0 = off)',
    def: 60,
    min: 0,
    max: 3600,
  },
  {
    key: 'ambientMaxPct',
    label: 'Too much light above (% of tolerance)',
    def: 60,
    min: 1,
    max: 100,
  },
  {
    key: 'marginMin',
    label: 'Weak below a margin of (×)',
    def: 2,
    min: 1,
    max: 20,
    step: 0.1,
  },
  {
    key: 'driftPct',
    label: 'Weak when lit drops by (%, 0 = off)',
    def: 30,
    min: 0,
    max: 100,
  },
  {
    key: 'deadDeltaUa',
    label: 'Dead when the LED changes it by less than (µA)',
    def: 2,
    min: 0,
    max: 1000,
    step: 0.1,
  },
  {
    key: 'deadChecks',
    label: 'Dead after checks in a row',
    def: 3,
    min: 1,
    max: 100,
  },
  {
    key: 'baselineMin',
    label: 'Baseline time constant (min, 0 = none)',
    def: 120,
    min: 0,
    max: 1440,
  },
  { key: 'reportS', label: 'Summary every (s)', def: 600, min: 60, max: 86400 },
  {
    key: 'ambientSwitchUa',
    label: 'Auto: A → B above ambient (µA)',
    def: 1.5,
    min: 0,
    max: 100,
    step: 0.05,
  },
  {
    key: 'ambientReturnUa',
    label: 'Auto: B → A below ambient (µA)',
    def: 0.75,
    min: 0,
    max: 100,
    step: 0.05,
  },
  {
    key: 'modeMinDwellS',
    label: 'Auto: minimum time in a mode (s)',
    def: 300,
    min: 0,
    max: 86400,
  },
  {
    key: 'settleMs',
    label: 'Settle after a switch (ms)',
    def: 3,
    min: 1,
    max: 20,
  },
];
const LED_DEFAULT: [number, number] = [1.0, 3.1];

/** The form's values as a config; an empty field is left out (default). */
export function parseBeamConfig(form: FormData): BeamConfig {
  const num = (name: string) => {
    const raw = String(form.get(name) ?? '').trim();
    return raw === '' ? undefined : Number(raw);
  };
  const config: BeamConfig = {};
  const mode = form.get('mode');
  if (mode) config.mode = mode as ConfigMode;
  for (const { key } of FIELDS) {
    const value = num(key);
    if (value !== undefined) config[key] = value;
  }
  const led = [num('ledMa0'), num('ledMa1')];
  // One pair on the wire: a blank half keeps its default.
  if (led.some((v) => v !== undefined))
    config.ledMa = [led[0] ?? LED_DEFAULT[0], led[1] ?? LED_DEFAULT[1]];
  return config;
}

/** Mode picker plus the fitted parts and thresholds behind "Advanced". */
export function BeamConfigForm({
  id,
  config: latest,
  onSave,
  onCancel,
}: {
  id: string;
  config?: BeamConfig | null;
  onSave: (config: BeamConfig) => void;
  onCancel: () => void;
}) {
  // The values it opened with: a save reloads the page data while the form
  // is still open, and an uncontrolled field must keep its default.
  const [config] = useState(latest);
  const [mode, setMode] = useState<ConfigMode>(config?.mode ?? 'A');
  const field = (name: string) => `beam-${name}-${id}`;
  return (
    <form
      className="w-full space-y-3 rounded-md bg-muted/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(parseBeamConfig(new FormData(event.currentTarget)));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={field('mode')}>Beam mode</Label>
        <select
          id={field('mode')}
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as ConfigMode)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-64"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground">
          {MODES.find((m) => m.value === mode)?.help}
        </p>
      </div>
      <details>
        <summary className="cursor-pointer">Advanced</summary>
        <p className="mt-2 text-muted-foreground">
          Leave a field empty for the firmware default (shown greyed).
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={field(f.key)}>{f.label}</Label>
              <Input
                id={field(f.key)}
                name={f.key}
                type="number"
                min={f.min}
                max={f.max}
                step={f.step ?? 1}
                placeholder={String(f.def)}
                defaultValue={config?.[f.key] ?? ''}
              />
            </div>
          ))}
          {(['LED current (mA)', 'Boost current (mA)'] as const).map(
            (label, i) => (
              <div key={label} className="space-y-1">
                <Label htmlFor={field(`ledMa${i}`)}>{label}</Label>
                <Input
                  id={field(`ledMa${i}`)}
                  name={`ledMa${i}`}
                  type="number"
                  min={0.1}
                  max={20}
                  step={0.1}
                  placeholder={String(LED_DEFAULT[i])}
                  defaultValue={config?.ledMa?.[i] ?? ''}
                />
              </div>
            )
          )}
        </div>
      </details>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save beam settings
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
