import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface PlayerLike {
  displayName?: string;
  username?: string;
}

interface PlayerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  user: PlayerLike;
}

export function PlayerButton({ user, className, ...rest }: PlayerButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        'flex w-full flex-col gap-1 rounded-md border border-input px-3 py-2 text-start ring-offset-background hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      type="button"
    >
      <p className="line-clamp-1 text-sm md:text-base">
        {user.displayName ?? user.username ?? 'Unknown'}
      </p>
      {user.displayName != null && user.username != null ? (
        <p className="text-xs">{user.username}</p>
      ) : null}
    </button>
  );
}
