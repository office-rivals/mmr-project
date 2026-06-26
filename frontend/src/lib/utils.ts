import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';
import type { BadgesResponse } from '../api-v3/models';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function parseLocalDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  d: string | null | undefined,
  fallback = '—',
  localeOptions?: Intl.DateTimeFormatOptions
): string {
  const date = parseLocalDate(d);
  if (!date) return fallback;
  return localeOptions
    ? date.toLocaleDateString(undefined, localeOptions)
    : date.toLocaleDateString();
}

export function formatDateTime(d: string | null | undefined): string {
  const date = parseLocalDate(d);
  return date ? date.toLocaleString() : '—';
}

const isSameDay = (d1: Date, d2: Date): boolean =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

/**
 * True when `d` falls on the same local calendar day as `now`.
 * `now` defaults to `Date.now()` and can be pinned (e.g. from PageData)
 * to avoid SSR/client hydration mismatches around midnight.
 */
export function isToday(
  d: string | null | undefined,
  now: number = Date.now()
): boolean {
  const date = parseLocalDate(d);
  return !!date && isSameDay(date, new Date(now));
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Stable YYYY-MM-DD key in local time for a date. Use for bucket boundary
 * comparison so labels with no year (`Wednesday, Mar 5`) don't collide across
 * years.
 */
export function matchDateGroupKey(
  d: string | null | undefined,
  now: number = Date.now()
): string {
  const date = parseLocalDate(d);
  if (!date) return '';
  const today = new Date(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'yesterday';
  if (isSameDay(date, today)) return 'today';
  return localDateKey(date);
}

/**
 * Display label for a match date bucket: empty for null inputs, "Yesterday"
 * for yesterday, otherwise a `Weekday, Mon D` string. Rendering only — do
 * not use for boundary comparison; use `matchDateGroupKey` instead.
 */
export function matchDateGroupLabel(
  d: string | null | undefined,
  now: number = Date.now()
): string {
  const date = parseLocalDate(d);
  if (!date) return '';
  if (matchDateGroupKey(d, now) === 'yesterday') return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Bucket a list of matches into adjacent date groups. The input must already
 * be sorted descending by `playedAt`; the first match in each new bucket
 * receives its display label, the rest get `null`.
 */
export function groupMatchesByDate<T extends { id: string; playedAt: string }>(
  matches: readonly T[],
  now: number = Date.now()
): { match: T; label: string | null }[] {
  const todayKey = matchDateGroupKey(new Date(now).toISOString(), now);
  return matches.map((match, i, arr) => {
    const matchKey = matchDateGroupKey(match.playedAt, now);
    const prevKey = i > 0 ? matchDateGroupKey(arr[i - 1].playedAt, now) : null;
    const newGroup = matchKey !== todayKey && matchKey !== prevKey;
    return {
      match,
      label: newGroup ? matchDateGroupLabel(match.playedAt, now) : null,
    };
  });
}

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

type FlyAndScaleParams = {
  y?: number;
  x?: number;
  start?: number;
  duration?: number;
};

export const flyAndScale = (
  node: Element,
  params: FlyAndScaleParams = { y: -8, x: 0, start: 0.95, duration: 150 }
): TransitionConfig => {
  const style = getComputedStyle(node);
  const transform = style.transform === 'none' ? '' : style.transform;

  const scaleConversion = (
    valueA: number,
    scaleA: [number, number],
    scaleB: [number, number]
  ) => {
    const [minA, maxA] = scaleA;
    const [minB, maxB] = scaleB;

    const percentage = (valueA - minA) / (maxA - minA);
    const valueB = percentage * (maxB - minB) + minB;

    return valueB;
  };

  const styleToString = (
    style: Record<string, number | string | undefined>
  ): string => {
    return Object.keys(style).reduce((str, key) => {
      if (style[key] === undefined) return str;
      return str + `${key}:${style[key]};`;
    }, '');
  };

  return {
    duration: params.duration ?? 200,
    delay: 0,
    css: (t) => {
      const y = scaleConversion(t, [0, 1], [params.y ?? 5, 0]);
      const x = scaleConversion(t, [0, 1], [params.x ?? 0, 0]);
      const scale = scaleConversion(t, [0, 1], [params.start ?? 0.95, 1]);

      return styleToString({
        transform: `${transform} translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        opacity: t,
      });
    },
    easing: cubicOut,
  };
};
