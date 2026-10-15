import { BarChart3, Home, Shuffle, Trophy, User } from 'lucide-react';
import { MatchmakingButton } from './matchmaking-button';
import { NavbarNav, NavbarSubmit } from './navbar-nav';

interface NavbarProps {
  base: string;
  orgId: string | null;
  leagueId: string | null;
  profilePath: string;
}

/**
 * The bottom bar on phones and the sidebar link list from `lg` up. Each width
 * shows five links: Leaderboard and Matches replace Submit and Profile in the
 * sidebar, which has its own Submit button and profile chip.
 */
export function Navbar({ base, orgId, leagueId, profilePath }: NavbarProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center border-t bg-card lg:static lg:z-auto lg:block lg:border-t-0 lg:bg-transparent"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex w-full max-w-screen-sm items-stretch px-1 lg:max-w-none lg:flex-col lg:gap-0.5 lg:px-0">
        <NavbarNav path={base} icon={Home} label="Home" />
        <NavbarNav
          path={`${base}/leaderboard`}
          icon={Trophy}
          label="Leaderboard"
          show="desktop"
        />
        <NavbarNav
          path={`${base}/matches`}
          icon={BarChart3}
          label="Matches"
          show="desktop"
        />
        {orgId && leagueId ? (
          <MatchmakingButton
            path={`${base}/matchmaking`}
            orgId={orgId}
            leagueId={leagueId}
          />
        ) : null}
        <NavbarSubmit path={`${base}/submit`} />
        <NavbarNav
          path="/random"
          icon={Shuffle}
          label="Random teams"
          shortLabel="Teams"
        />
        <NavbarNav
          path={profilePath}
          icon={User}
          label="Profile"
          show="mobile"
        />
      </div>
    </nav>
  );
}
