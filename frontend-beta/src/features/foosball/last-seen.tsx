import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { relativeParts } from './format';

/** "2 minutes ago", or "never" for a device that has not checked in. */
export function LastSeen({ at }: { at?: string | null }) {
  const { formatRelativeTime, formatDateTime } = useLocaleFormatters();
  if (!at) return <>never</>;
  const [value, unit] = relativeParts(Date.now() - Date.parse(at));
  return (
    // Server and client clocks render a few seconds apart.
    <time dateTime={at} title={formatDateTime(at)} suppressHydrationWarning>
      {formatRelativeTime(value, unit, { numeric: 'auto' })}
    </time>
  );
}
