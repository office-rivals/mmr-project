import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The flag action beside a match card; red once the viewer has flagged it. */
export function MatchFlagButton({
  flagged,
  disabled,
  onClick,
}: {
  flagged: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const label = flagged ? 'Edit flag' : 'Flag this match';
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className={cn(
        'rounded-lg px-2.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50',
        flagged ? 'text-red-500' : 'text-muted-foreground'
      )}
      onClick={onClick}
    >
      <Flag aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
