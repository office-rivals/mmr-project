import { useSyncExternalStore } from 'react';
import {
  dateTimeFormat,
  formatDate,
  formatDateTime,
  groupMatchesByDate,
  matchDateGroupKey,
  numberFormat,
  relativeTimeFormat,
  type DatePresentation,
} from '@/lib/utils';

function createFormatters(presentation?: DatePresentation) {
  return {
    formatDate: (
      value: string | null | undefined,
      fallback = '—',
      options?: Intl.DateTimeFormatOptions
    ) => formatDate(value, fallback, options, presentation),
    formatDateTime: (value: string | null | undefined) =>
      formatDateTime(value, presentation),
    formatTime: (value: string) =>
      dateTimeFormat(presentation?.locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: presentation?.timeZone,
      }).format(new Date(value)),
    formatNumber: (value: number, options: Intl.NumberFormatOptions) =>
      numberFormat(presentation?.locale, options).format(value),
    formatRelativeTime: (
      value: number,
      unit: Intl.RelativeTimeFormatUnit,
      options: Intl.RelativeTimeFormatOptions
    ) => relativeTimeFormat(presentation?.locale, options).format(value, unit),
    /** `Today`, `Yesterday` or a short weekday date, for match headers. */
    formatMatchDay: (value: string, now: number) => {
      const key = matchDateGroupKey(value, now, presentation);
      if (key === 'today') return 'Today';
      if (key === 'yesterday') return 'Yesterday';
      return dateTimeFormat(presentation?.locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: presentation?.timeZone,
      }).format(new Date(value));
    },
    groupMatchesByDate: <T extends { id: string; playedAt: string }>(
      matches: readonly T[],
      now: number
    ) => groupMatchesByDate(matches, now, presentation),
  };
}

const initialFormatters = createFormatters({
  locale: 'en-US',
  timeZone: 'UTC',
});
const browserFormatters = createFormatters();
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function useLocaleFormatters() {
  // Hydration must match UTC server HTML before adopting the browser's locale.
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
    ? browserFormatters
    : initialFormatters;
}
