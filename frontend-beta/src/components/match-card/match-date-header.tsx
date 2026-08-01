import type { HTMLAttributes } from 'react';

interface MatchDateHeaderProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
}

/**
 * Date separator between match cards. Deliberately NOT class-mergeable: the
 * rest props are spread after `className`, so a caller-supplied class replaces
 * the base string (no current caller passes one) — same as the Svelte version.
 * `uppercase` is CSS-only, so the DOM text stays mixed case ("Yesterday"),
 * which is what Playwright asserts on.
 */
export function MatchDateHeader({ label, ...rest }: MatchDateHeaderProps) {
  return (
    <div
      className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      {...rest}
    >
      {label}
    </div>
  );
}
