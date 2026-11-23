import { SHOW_STREAK_THRESHOLD } from '@/lib/constants';
import { streakGlyph } from '@/lib/streak';

/** Trails a "W5" / "L5" label once the streak is long enough to call out. */
export function TileStreakGlyph({
  winningStreak,
  losingStreak,
}: {
  winningStreak: number;
  losingStreak: number;
}) {
  const win = winningStreak >= SHOW_STREAK_THRESHOLD;
  if (!win && losingStreak < SHOW_STREAK_THRESHOLD) return null;
  return ` ${streakGlyph(win, win ? winningStreak : losingStreak)}`;
}
