import type { OfficeHours, StatValue } from './api';

export const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** Seconds as m:ss, e.g. 270 → "4:30". */
export function mmss(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The text for one number, plus a note when the sample is too small to trust
 * (the value is still shown, as analytics asks).
 */
export function statText(
  stat: StatValue,
  format: (value: number) => string,
  unit = 'games'
) {
  return {
    text: stat.value == null ? '–' : format(stat.value),
    note: stat.enough
      ? null
      : `Not enough ${unit} yet (${stat.n} of ${stat.minN})`,
  };
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const cap = (day: string) => day[0].toUpperCase() + day.slice(1);

/** "Mon–Fri 08:00–18:00"; separate days when they aren't a run. */
export function officeHoursText({ days, start, end }: OfficeHours) {
  const idx = days.map((d) => DAYS.indexOf(d)).sort((a, b) => a - b);
  const run =
    idx.length > 2 && idx.every((d, i) => i === 0 || d === idx[i - 1] + 1);
  const dayText = run
    ? `${cap(DAYS[idx[0]])}–${cap(DAYS[idx[idx.length - 1]])}`
    : idx.map((d) => cap(DAYS[d])).join(', ');
  return `${dayText} ${start}–${end}`;
}

/** Weekday labels for the heatmap rows, Monday first. */
export const WEEKDAYS = DAYS.map(cap);
