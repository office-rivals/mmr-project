import { useCallback, useEffect, useId, useState } from 'react';
import { moveHighlight, resolveEnterTarget } from '@/lib/combobox';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

interface UsePlayerComboboxOptions {
  options: string[];
  filterLength: number;
  requireArrow: boolean;
  minFilterLength: number;
  initialOpen?: boolean;
  onSelect: (optionValue: string) => void;
  onEscape: () => void;
}

// ids end up in aria-controls / aria-activedescendant, so strip anything that
// is not id-safe out of the option value.
const idSafe = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '-');

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
  const inputId = `${id}-input`;
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(initialOpen);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [arrowed, setArrowed] = useState(false);

  const optionId = useCallback(
    (value: string) => `${id}-option-${idSafe(value)}`,
    [id]
  );

  const clearHighlight = useCallback(() => {
    setHighlighted(null);
    setArrowed(false);
  }, []);

  const onFilterInput = useCallback(() => {
    setOpen(true);
    clearHighlight();
  }, [clearHighlight]);

  const select = useCallback(
    (value: string) => {
      clearHighlight();
      setOpen(false);
      onSelect(value);
    },
    [clearHighlight, onSelect]
  );

  const dismiss = useCallback(() => {
    setOpen(false);
    setHighlighted(null);
  }, []);

  useEffect(() => {
    if (!open || options.length === 0) {
      if (options.length === 0) setHighlighted(null);
      return;
    }
    setHighlighted((current) =>
      current !== null && options.includes(current) ? current : options[0]
    );
  }, [open, options]);

  useEffect(() => {
    if (!open || highlighted === null) return;
    document
      .getElementById(optionId(highlighted))
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open, optionId]);

  useEffect(() => {
    if (!open) return;
    const handleOutsideInteraction = (event: Event) => {
      const target = event.target as Node | null;
      // A dialog opened from the list is a higher layer; keep its source
      // mounted behind the modal, as Bits UI does.
      if (target instanceof Element && target.closest('[role="dialog"]')) {
        return;
      }
      if (
        target !== null &&
        (document.getElementById(inputId)?.contains(target) ||
          document.getElementById(listboxId)?.contains(target))
      ) {
        return;
      }
      dismiss();
    };
    document.addEventListener('pointerdown', handleOutsideInteraction);
    document.addEventListener('focusin', handleOutsideInteraction);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideInteraction);
      document.removeEventListener('focusin', handleOutsideInteraction);
    };
  }, [dismiss, inputId, listboxId, open]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      // An IME confirms its candidate with Enter; that keypress is not a pick.
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') {
        onEscape();
        dismiss();
        clearHighlight();
        return;
      }
      if (event.key === 'Tab') {
        dismiss();
        return;
      }
      if (event.key === 'ArrowUp' && event.altKey) {
        event.preventDefault();
        dismiss();
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
      if (
        event.key === 'Home' ||
        event.key === 'End' ||
        event.key === 'PageUp' ||
        event.key === 'PageDown'
      ) {
        if (!open || options.length === 0) return;
        event.preventDefault();
        if (event.key === 'Home') setHighlighted(options[0]);
        else if (event.key === 'End')
          setHighlighted(options[options.length - 1]);
        else
          setHighlighted((current) =>
            moveHighlight(
              options,
              current,
              event.key === 'PageDown' ? 'down' : 'up',
              10
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
      dismiss,
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
    id: inputId,
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
    'aria-selected': undefined,
    'data-highlighted': highlighted === value ? '' : undefined,
    onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== 'touch') setHighlighted(value);
    },
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      // A touch click is handled after pointerup so it cannot fall through to
      // the element revealed when selecting removes the popup.
      if (event.pointerType === 'touch') return;
      event.preventDefault();
      select(value);
    },
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
