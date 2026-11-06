/** Long win streaks take off; long losing streaks freeze, then worse. */
const WIN_STEPS = [
  { from: 11, glyph: '🐐' },
  { from: 7, glyph: '🚀' },
  { from: 0, glyph: '🔥' },
] as const;

const LOSS_STEPS = [
  { from: 13, glyph: '🪦' },
  { from: 10, glyph: '☃️' },
  { from: 7, glyph: '❄️' },
  { from: 5, glyph: '⛈️' },
  { from: 0, glyph: '🌧️' },
] as const;

export function streakGlyph(win: boolean, length: number): string {
  const steps = win ? WIN_STEPS : LOSS_STEPS;
  return (steps.find((s) => length >= s.from) ?? steps[steps.length - 1]).glyph;
}
