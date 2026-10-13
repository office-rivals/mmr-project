import { useSyncExternalStore } from 'react';
import {
  formatDate,
  formatDateTime,
  groupMatchesByDate,
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
      new Date(value).toLocaleTimeString(presentation?.locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: presentation?.timeZone,
      }),
    formatNumber: (value: number, options: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(presentation?.locale, options).format(value),
    formatRelativeTime: (
      value: number,
      unit: Intl.RelativeTimeFormatUnit,
      options: Intl.RelativeTimeFormatOptions
    ) =>
      new Intl.RelativeTimeFormat(presentation?.locale, options).format(
        value,
        unit
      ),
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
