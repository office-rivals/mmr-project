import { useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react';

type BaseUIKeyboardEvent = KeyboardEvent<HTMLInputElement> & {
  preventBaseUIHandler?: () => void;
};

/**
 * Open state for a Base UI Combobox rendered `inline`. Inline mode turns off
 * Base UI's own dismissal (outside press, Escape), so the list shows while the
 * input has focus and hides on blur, Escape and Tab.
 */
export function useInlineList({
  initialOpen = false,
  onEscape,
}: {
  initialOpen?: boolean;
  onEscape: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const listRef = useRef<HTMLDivElement>(null);

  const inputProps = {
    onFocus: () => setOpen(true),
    onClick: () => setOpen(true),
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      const next = event.relatedTarget;
      // A dialog opened from the list is a layer above it, so the list stays
      // mounted behind the modal.
      if (
        next instanceof Element &&
        (listRef.current?.contains(next) || next.closest('[role="dialog"]'))
      ) {
        return;
      }
      setOpen(false);
    },
    onKeyDown: (event: BaseUIKeyboardEvent) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Enter') {
        // Implicit submission would post the enclosing form.
        event.preventDefault();
        // Base UI still tracks a highlight while the list is hidden.
        if (!open) event.preventBaseUIHandler?.();
      } else if (event.key === 'Escape') {
        onEscape();
        setOpen(false);
      } else if (event.key === 'Tab') {
        setOpen(false);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        setOpen(true);
      }
    },
  };

  const listProps = {
    ref: listRef,
    // Keeps focus in the input when a button beside the options is pressed;
    // WebKit would otherwise blur it and hide the list before the click lands.
    onMouseDown: (event: MouseEvent) => event.preventDefault(),
  };

  return { open, setOpen, inputProps, listProps };
}
