import { useClerk } from '@clerk/tanstack-react-start';
import { useRouter } from '@tanstack/react-router';
import { IdCard, KeyRound, LogOut, Settings, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getPlayerDisplayName,
  getRoleBadgeVariant,
  isModeratorOrAbove,
} from '@/lib/utils';
import type { MeOrganizationResponse } from '@/api-v3';

interface SettingsMenuProps {
  organizations: MeOrganizationResponse[];
  menuOrg: MeOrganizationResponse | undefined;
  displayName: string | null;
  username: string | null;
  openFlagCount: number;
}

export function SettingsMenu({
  organizations,
  menuOrg,
  displayName,
  username,
  openFlagCount,
}: SettingsMenuProps) {
  const router = useRouter();
  const { signOut } = useClerk();

  const primaryName = getPlayerDisplayName({ displayName, username }, 'You');
  // The @handle is a subtitle only when the primary line is the display name;
  // otherwise the handle is already the primary line.
  const secondaryName = displayName && username ? `@${username}` : null;

  // Visible if the user administers *any* org …
  const hasAdminAccess = organizations.some((o) => isModeratorOrAbove(o.role));
  // … but deep-linked only when they administer the currently-scoped one.
  const adminHref =
    menuOrg && isModeratorOrAbove(menuOrg.role)
      ? `/admin/${menuOrg.slug}`
      : '/admin';

  // Only alert when the user can actually act on it. The count and the
  // organizations list come from separate requests, so a profile failure can
  // leave a non-zero count with no Admin entry to reach — don't paint a red
  // dot the user has no way to resolve.
  const showFlagDot = hasAdminAccess && openFlagCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:size-10"
        aria-label={
          showFlagDot
            ? 'Settings menu — unresolved match flags need attention'
            : 'Settings menu'
        }
      >
        <Settings className="h-5 w-5" />
        {showFlagDot && (
          <span
            className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card"
            aria-hidden="true"
          />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[min(18rem,calc(100vw-2rem))] overflow-hidden p-0"
        align="end"
      >
        <div className="border-b border-muted px-4 py-3">
          <div className="truncate text-sm font-semibold">{primaryName}</div>
          {secondaryName && (
            <div className="truncate text-xs text-muted-foreground">
              {secondaryName}
            </div>
          )}
          {menuOrg && (
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{menuOrg.name}</span>
              <Badge
                variant={getRoleBadgeVariant(menuOrg.role)}
                className="shrink-0 tracking-wider uppercase"
              >
                {menuOrg.role}
              </Badge>
            </div>
          )}
        </div>

        <div className="p-1">
          <DropdownMenuItem
            onSelect={() => void router.navigate({ href: '/settings' })}
          >
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Personal Access Tokens
          </DropdownMenuItem>
          {menuOrg && (
            <DropdownMenuItem
              onSelect={() =>
                void router.navigate({ href: `/${menuOrg.slug}/cards` })
              }
            >
              <IdCard className="h-4 w-4 text-muted-foreground" />
              My badges
            </DropdownMenuItem>
          )}
          {hasAdminAccess && (
            <DropdownMenuItem
              onSelect={() => void router.navigate({ href: adminHref })}
            >
              <Shield className="h-4 w-4 text-muted-foreground" />
              Admin
              {openFlagCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-auto"
                  aria-label={`${openFlagCount} unresolved match flags`}
                >
                  {openFlagCount}
                </Badge>
              )}
            </DropdownMenuItem>
          )}
        </div>

        <DropdownMenuSeparator />

        <div className="p-1">
          <DropdownMenuItem
            onSelect={() => void signOut({ redirectUrl: '/login' })}
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
