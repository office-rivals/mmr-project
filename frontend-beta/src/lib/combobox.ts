/**
 * Keyboard rules shared by the two player pickers, kept as pure functions so
 * they can be unit-tested without a DOM.
 *
 * Option values are the picker's own encoding (`league:<id>` / `member:<id>`
 * in the submit slots, a bare LeaguePlayer id in the profile filter); this
 * module only ever compares them.
 */

export interface EnterTargetInput {
  /** Option values in render order, so `options[0]` is the top suggestion. */
  options: string[];
  /** Option value currently highlighted, if any. */
  highlighted: string | null;
  /** Whether the highlight came from an ArrowUp/ArrowDown press. */
  arrowed: boolean;
  filterLength: number;
  /**
   * Require the highlight to have been arrowed to before Enter acts on it.
   * The submit slots need this: they show recents with an empty filter, and an
   * untouched list of recents is not a choice.
   */
  requireArrow: boolean;
  /** Shortest filter whose top match Enter may pick. */
  minFilterLength: number;
}

/** The option Enter should select, or `undefined` for "Enter does nothing". */
export function resolveEnterTarget({
  options,
  highlighted,
  arrowed,
  filterLength,
  requireArrow,
  minFilterLength,
}: EnterTargetInput): string | undefined {
  const highlightIsUsable =
    highlighted !== null &&
    options.includes(highlighted) &&
    (arrowed || !requireArrow);
  if (highlightIsUsable) return highlighted ?? undefined;
  if (filterLength >= minFilterLength) return options[0];
  return undefined;
}

/** Next highlight for an arrow or page press. Both player pickers enable loop. */
export function moveHighlight(
  options: string[],
  highlighted: string | null,
  direction: 'down' | 'up',
  steps = 1
): string | null {
  if (options.length === 0) return null;
  const index = highlighted === null ? -1 : options.indexOf(highlighted);
  if (index === -1) return direction === 'down' ? options[0] : options.at(-1)!;
  const unwrapped = direction === 'down' ? index + steps : index - steps;
  const next = ((unwrapped % options.length) + options.length) % options.length;
  return options[next];
}
