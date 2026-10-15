import { cn, initials } from '@/lib/utils';

interface PlayerAvatarProps {
  name: string;
  highlight?: boolean;
  dashed?: boolean;
  className?: string;
}

/** Initials in a ring; decorative, so the name must be rendered beside it. */
export function PlayerAvatar({
  name,
  highlight = false,
  dashed = false,
  className,
}: PlayerAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
        highlight
          ? 'border-primary text-primary'
          : 'border-muted-foreground/50 text-foreground',
        dashed && 'border-dashed',
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
