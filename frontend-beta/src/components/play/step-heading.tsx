import type { ReactNode } from 'react';

/** A numbered step title; the number is decorative, so names stay stable. */
export function StepHeading({
  step,
  children,
}: {
  step?: number;
  children: ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-semibold">
      {step != null ? (
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
        >
          {step}
        </span>
      ) : null}
      {children}
    </h2>
  );
}
