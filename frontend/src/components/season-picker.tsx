import { useMemo } from 'react';
import type { SeasonResponse } from '@/api-v3/models';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHydrated } from '@/hooks/use-hydrated';

export interface SeasonPickerProps {
  seasons: SeasonResponse[];
  currentSeason: SeasonResponse;
  selectedSeasonId?: string;
  onSeasonChange: (season: SeasonResponse) => void;
}

export function SeasonPicker({
  seasons,
  currentSeason,
  selectedSeasonId,
  onSeasonChange,
}: SeasonPickerProps) {
  const hydrated = useHydrated();

  const selectedSeason =
    (selectedSeasonId
      ? seasons.find((s) => s.id === selectedSeasonId)
      : undefined) ?? currentSeason;

  // The API returns seasons newest-first, while labels count from the oldest.
  const items = useMemo(
    () =>
      seasons.map((season, index) => ({
        value: season.id,
        label:
          season.id === currentSeason.id
            ? 'Current Season'
            : `Season ${seasons.length - index}`,
      })),
    [seasons, currentSeason.id]
  );

  return (
    <Select
      items={items}
      value={selectedSeason.id}
      onValueChange={(seasonId) => {
        const season = seasons.find((s) => s.id === seasonId);
        if (season) onSeasonChange(season);
      }}
      disabled={!hydrated}
    >
      <SelectTrigger aria-label="Select a season">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
