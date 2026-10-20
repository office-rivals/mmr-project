const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', Infinity],
];

/** Largest whole unit for an age in ms, e.g. 90 min → [-1, 'hour']. */
export function relativeParts(
  ageMs: number
): [number, Intl.RelativeTimeFormatUnit] {
  let value = Math.max(0, ageMs) / 1000;
  for (const [unit, size] of STEPS) {
    if (value < size) return [-Math.floor(value), unit];
    value /= size;
  }
  return [-Math.floor(value), 'day'];
}

export const formatVolts = (mv: number | null | undefined) =>
  mv == null ? '—' : `${(mv / 1000).toFixed(2)} V`;

/** INTERFACES §10: a heartbeat at least every 24 h; alert after 36 h silent. */
export const SILENT_AFTER_MS = 36 * 3_600_000;
