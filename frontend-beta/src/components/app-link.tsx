import type { AnchorHTMLAttributes, ComponentType, ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

export interface AppLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  /** A fully-built path, e.g. `/test-org/test-league/player/<id>`. */
  to: string;
  /**
   * Query params. `to` is a pathname only — a `?a=b` embedded in it is
   * percent-encoded into the path — and omitting this **drops** the current
   * location's search, so a link that must carry `?season=` has to pass it
   * here (`true` keeps the current search verbatim).
   */
  search?: Record<string, unknown> | true;
  replace?: boolean;
  children?: ReactNode;
}

/**
 * `<Link>` for paths built at runtime.
 *
 * TanStack Router's `to` is a literal union of known route ids, so a value like
 * `` `/${orgSlug}/${leagueSlug}/submit` `` cannot typecheck — and a plain `<a>`
 * would trigger a full document reload, losing client state and re-running the
 * whole shell. This keeps the router navigation and drops only the compile-time
 * path check.
 *
 * Use the real `<Link to="/literal/path">` wherever the target is a literal
 * route; reach for this only for slug/id-interpolated paths.
 */
export const AppLink = Link as unknown as ComponentType<AppLinkProps>;
