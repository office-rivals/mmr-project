import { useCallback, useId, useState } from 'react';
import { moveHighlight, resolveEnterTarget } from '@/lib/combobox';
import type { KeyboardEvent } from 'react';

interface UsePlayerComboboxOptions {
  /** Option values in render order. */
  options: string[];
  filterLength: number;
  /** See `resolveEnterTarget`. */
  requireArrow: boolean;
  minFilterLength: number;
  /** Start open — an autofocused input never sends a focus event we can hear. */
  initialOpen?: boolean;
  onSelect: (optionValue: string) => void;
  /** Escape: clear the filter text the component owns. */
  onEscape: () => void;
}

// ids end up in aria-controls / aria-activedescendant, so strip anything that
// is not id-safe out of the option value.
const idSafe = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '-');

/**
 * The keyboard half of the two player pickers, with the ARIA wiring the e2e
 * suite asserts (`role="combobox"` input, `role="listbox"` popup,
 * `role="option"` suggestions carrying `data-highlighted`).
 *
 * There is no Radix/shadcn combobox in this app — `components/ui` is the plain
 * CLI set — and adding `cmdk` would change the DOM roles the specs pin, so this
 * is deliberately headless.
 *
 * Highlighting is keyboard-only: bits-ui also highlighted on hover, but that
 * would make Enter act on whatever the pointer happened to rest over.
 */
export function usePlayerCombobox({
  options,
  filterLength,
  requireArrow,
  minFilterLength,
  initialOpen = false,
  onSelect,
  onEscape,
}: UsePlayerComboboxOptions) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(initialOpen);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [arrowed, setArrowed] = useState(false);

  const optionId = useCallback(
    (value: string) => `${id}-option-${idSafe(value)}`,
    [id]
  );

  /** Forget the keyboard state — after a pick, a reset or an Escape. */
  const clearHighlight = useCallback(() => {
    setHighlighted(null);
    setArrowed(false);
  }, []);

  /** Input arrived (typed, pasted, autofilled or adopted at hydration). */
  const onFilterInput = useCallback(() => {
    setOpen(true);
    clearHighlight();
  }, [clearHighlight]);

  const select = useCallback(
    (value: string) => {
      clearHighlight();
      onSelect(value);
    },
    [clearHighlight, onSelect]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      // An IME confirms its candidate with Enter; that keypress is not a pick.
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') {
        onEscape();
        setOpen(false);
        clearHighlight();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true);
        // Remembering that the user arrowed is what stops Enter from acting on
        // a highlight the list produced by itself.
        setArrowed(true);
        setHighlighted((current) =>
          moveHighlight(
            options,
            current,
            event.key === 'ArrowDown' ? 'down' : 'up'
          )
        );
        return;
      }
      if (event.key !== 'Enter') return;
      // Enter must never reach the form: implicit submission posts an empty
      // match.
      event.preventDefault();
      if (!open) return;
      const target = resolveEnterTarget({
        options,
        highlighted,
        arrowed,
        filterLength,
        requireArrow,
        minFilterLength,
      });
      if (target !== undefined) select(target);
    },
    [
      arrowed,
      clearHighlight,
      filterLength,
      highlighted,
      minFilterLength,
      onEscape,
      open,
      options,
      requireArrow,
      select,
    ]
  );

  const inputProps = {
    role: 'combobox' as const,
    'aria-expanded': open,
    'aria-controls': listboxId,
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant':
      open && highlighted !== null ? optionId(highlighted) : undefined,
    onKeyDown,
    onFocus: () => setOpen(true),
    onClick: () => setOpen(true),
  };

  const listboxProps = { id: listboxId, role: 'listbox' as const };

  const getOptionProps = (value: string) => ({
    id: optionId(value),
    role: 'option' as const,
    'aria-selected': highlighted === value,
    'data-highlighted': highlighted === value ? '' : undefined,
    onClick: () => select(value),
  });

  return {
    open,
    setOpen,
    clearHighlight,
    onFilterInput,
    inputProps,
    listboxProps,
    getOptionProps,
  };
}
