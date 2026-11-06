import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'success' | 'warning' | 'error' | 'info';

interface StatusIndicatorProps {
  variant: Variant;
  className?: string;
  children?: ReactNode;
}

export function StatusIndicator({
  variant,
  className,
  children,
}: StatusIndicatorProps) {
  return (
    <span className={cn('inline-block', className)}>
      <span className="relative inline-flex">
        <span
          className={cn(
            'absolute inset-0 inline-flex animate-ping rounded-full opacity-75',
            {
              'bg-green-400': variant === 'success',
              'bg-yellow-400': variant === 'warning',
              'bg-red-400': variant === 'error',
              'bg-blue-400': variant === 'info',
              'bg-primary/90': variant === 'primary',
            }
          )}
        />
        <span
          className={cn(
            'relative inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.65rem] text-white',
            {
              'bg-green-500': variant === 'success',
              'bg-yellow-500': variant === 'warning',
              'bg-red-500': variant === 'error',
              'bg-blue-500': variant === 'info',
              'bg-primary': variant === 'primary',
            }
          )}
        >
          {children}
        </span>
      </span>
    </span>
  );
}
