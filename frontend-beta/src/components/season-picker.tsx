import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import type { SeasonResponse } from '@/api-v3/models';

export interface SeasonPickerProps {
  seasons: SeasonResponse[];
  currentSeason: SeasonResponse;
  /** `?season=` from the URL, when it names a season this league actually has. */
  selectedSeasonId?: string;
  /** Season switching is a URL change + full loader re-run, never client filtering. */
  onSeasonChange: (season: SeasonResponse) => void;
}

/**
 * Hand-rolled listbox rather than a `Select` primitive: the UI library
 * deliberately ships no `Select` (spec 08 §8), and the trigger has to keep
 * rendering the current label as visible text — e2e asserts
 * `getByText('Current Season')` is visible without opening anything.
 */
export function SeasonPicker({
  seasons,
  currentSeason,
  selectedSeasonId,
  onSeasonChange,
}: SeasonPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedSeason =
    (selectedSeasonId
      ? seasons.find((s) => s.id === selectedSeasonId)
      : undefined) ?? currentSeason;

  // Assumes the API returns seasons newest-first: the newest gets
  // `seasons.length`, the oldest `1`. Re-sorting the array breaks the labels.
  const seasonNumbers = useMemo(
    () =>
      new Map(
        seasons.map((season, index) => [season.id, seasons.length - index])
      ),
    [seasons]
  );

  const seasonLabel = (season: SeasonResponse): string =>
    season.id === currentSeason.id
      ? 'Current Season'
      : `Season ${seasonNumbers.get(season.id) ?? '?'}`;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const select = (season: SeasonResponse) => {
    setOpen(false);
    onSeasonChange(season);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Select a season"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {seasonLabel(selectedSeason)}
        <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground" />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Select a season"
          className="absolute right-0 z-50 mt-2 max-h-96 w-max min-w-full overflow-auto rounded-md border border-muted bg-background p-1 shadow-lg focus:outline-none"
        >
          {seasons.map((season) => {
            const isSelected = season.id === selectedSeason.id;
            return (
              <li
                key={season.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => select(season)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    select(season);
                  }
                }}
                className="flex h-10 w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm capitalize hover:bg-muted aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                {seasonLabel(season)}
                {isSelected ? (
                  <Check className="ml-2 mr-1 h-4 w-4 text-ring" />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
