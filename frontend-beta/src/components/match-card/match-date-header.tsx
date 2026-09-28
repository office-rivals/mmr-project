import type { HTMLAttributes } from 'react';

interface MatchDateHeaderProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
}

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
