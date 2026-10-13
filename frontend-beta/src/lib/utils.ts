export { cn } from 'cn';
import type { BadgesResponse } from '@/api-v3';

export interface DatePresentation {
  locale?: string;
  timeZone?: 'UTC';
}

function parseLocalDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  d: string | null | undefined,
  fallback = '—',
  localeOptions?: Intl.DateTimeFormatOptions,
  presentation?: DatePresentation
): string {
  const date = parseLocalDate(d);
  if (!date) return fallback;
  return date.toLocaleDateString(presentation?.locale, {
    ...localeOptions,
    timeZone: presentation?.timeZone,
  });
}

export function formatDateTime(
  d: string | null | undefined,
  presentation?: DatePresentation
): string {
  const date = parseLocalDate(d);
  return date
    ? date.toLocaleString(presentation?.locale, {
        timeZone: presentation?.timeZone,
      })
    : '—';
}

const isSameDay = (d1: Date, d2: Date): boolean =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

/**
 * True when `d` falls on the same local calendar day as `now`.
 * `now` defaults to `Date.now()` and can be pinned (e.g. from loader data)
 * to avoid SSR/client hydration mismatches around midnight.
 */
export function isToday(
  d: string | null | undefined,
  now: number = Date.now()
): boolean {
  const date = parseLocalDate(d);
  return !!date && isSameDay(date, new Date(now));
}

function localDateKey(date: Date, presentation?: DatePresentation): string {
  const utc = presentation?.timeZone === 'UTC';
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  const month = utc ? date.getUTCMonth() : date.getMonth();
  const day = utc ? date.getUTCDate() : date.getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Stable YYYY-MM-DD key in local time for a date. Use for bucket boundary
 * comparison so labels with no year (`Wednesday, Mar 5`) don't collide across
 * years.
 */
export function matchDateGroupKey(
  d: string | null | undefined,
  now: number = Date.now(),
  presentation?: DatePresentation
): string {
  const date = parseLocalDate(d);
  if (!date) return '';
  const today = new Date(now);
  const yesterday = new Date(today);
  if (presentation?.timeZone === 'UTC') {
    yesterday.setUTCDate(today.getUTCDate() - 1);
  } else {
    yesterday.setDate(today.getDate() - 1);
  }
  const key = localDateKey(date, presentation);
  if (key === localDateKey(yesterday, presentation)) return 'yesterday';
  if (key === localDateKey(today, presentation)) return 'today';
  return key;
}

/**
 * Display label for a match date bucket: empty for null inputs, "Yesterday"
 * for yesterday, otherwise a `Weekday, Mon D` string. Rendering only — do
 * not use for boundary comparison; use `matchDateGroupKey` instead.
 */
export function matchDateGroupLabel(
  d: string | null | undefined,
  now: number = Date.now(),
  presentation?: DatePresentation
): string {
  const date = parseLocalDate(d);
  if (!date) return '';
  if (matchDateGroupKey(d, now, presentation) === 'yesterday')
    return 'Yesterday';
  return date.toLocaleDateString(presentation?.locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: presentation?.timeZone,
  });
}

/**
 * Bucket a list of matches into adjacent date groups. The input must already
 * be sorted descending by `playedAt`; the first match in each new bucket
 * receives its display label, the rest get `null`.
 */
export function groupMatchesByDate<T extends { id: string; playedAt: string }>(
  matches: readonly T[],
  now: number = Date.now(),
  presentation?: DatePresentation
): { match: T; label: string | null }[] {
  const todayKey = matchDateGroupKey(
    new Date(now).toISOString(),
    now,
    presentation
  );
  return matches.map((match, i, arr) => {
    const matchKey = matchDateGroupKey(match.playedAt, now, presentation);
    const prevKey =
      i > 0 ? matchDateGroupKey(arr[i - 1].playedAt, now, presentation) : null;
    const newGroup = matchKey !== todayKey && matchKey !== prevKey;
    return {
      match,
      label: newGroup
        ? matchDateGroupLabel(match.playedAt, now, presentation)
        : null,
    };
  });
}

// `??`, not `||`: an empty-string displayName deliberately wins over username.
// MatchCard has the OPPOSITE precedence (username first) — do not unify them.
export function getPlayerDisplayName(
  p:
    | { displayName?: string | null; username?: string | null }
    | null
    | undefined,
  fallback = 'Unknown'
): string {
  return p?.displayName ?? p?.username ?? fallback;
}

export function formatLeagueFormat(teamSize: number): string {
  return `${teamSize}v${teamSize}`;
}

// Deliberately returns the generic badge variants, not the owner/moderator/user
// role variants that also exist on Badge.
export function getRoleBadgeVariant(
  role: string
): 'default' | 'secondary' | 'outline' {
  if (role === 'Owner') return 'default';
  if (role === 'Moderator') return 'secondary';
  return 'outline';
}

// Whether an organization role grants admin access (Owner or Moderator).
// Accepts the OrganizationRole string enum or a raw role string.
export function isModeratorOrAbove(role: string): boolean {
  return role === 'Owner' || role === 'Moderator';
}

// Open match-flag counts from the badges endpoint, keyed by org/league id.
// Default to 0 so non-admins and ids without flags read cleanly.
export function openFlagsForOrg(
  badges: BadgesResponse | null | undefined,
  orgId: string
): number {
  return badges?.openMatchFlags?.byOrganization?.[orgId] ?? 0;
}

export function openFlagsForLeague(
  badges: BadgesResponse | null | undefined,
  leagueId: string
): number {
  return badges?.openMatchFlags?.byLeague?.[leagueId] ?? 0;
}

// Two-letter monogram for avatars and the organization badge.
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}
