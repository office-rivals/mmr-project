import { ChevronDown } from 'lucide-react';
import type { PartnerOption } from '@/lib/player-stats';

export interface PartnerSelection {
  with?: string;
  against?: string;
}

interface PartnerFiltersProps {
  teammates: PartnerOption[];
  opponents: PartnerOption[];
  value: PartnerSelection;
  disabled: boolean;
  onChange: (next: PartnerSelection) => void;
}

/** Narrows the viewer's own matches to one teammate and/or one opponent. */
export function PartnerFilters({
  teammates,
  opponents,
  value,
  disabled,
  onChange,
}: PartnerFiltersProps) {
  return (
    <div
      role="group"
      aria-label="Filter my matches"
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      <PartnerSelect
        label="With"
        anyLabel="Any teammate"
        options={teammates}
        value={value.with}
        disabled={disabled}
        onChange={(id) => onChange({ ...value, with: id })}
      />
      <PartnerSelect
        label="Against"
        anyLabel="Anyone"
        options={opponents}
        value={value.against}
        disabled={disabled}
        onChange={(id) => onChange({ ...value, against: id })}
      />
      {value.with || value.against ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({})}
          className="rounded-full px-2 py-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function PartnerSelect({
  label,
  anyLabel,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  anyLabel: string;
  options: PartnerOption[];
  value: string | undefined;
  disabled: boolean;
  onChange: (id: string | undefined) => void;
}) {
  return (
    <label className="relative flex min-w-0 items-center rounded-full border bg-card text-sm focus-within:ring-2 focus-within:ring-ring has-disabled:opacity-60">
      <span className="pl-3 text-muted-foreground">{label}</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || undefined)}
        // The native picker follows the page theme rather than the OS one.
        className="max-w-40 min-w-0 appearance-none truncate bg-transparent py-1.5 pr-8 pl-1.5 font-medium [color-scheme:light] focus:outline-none dark:[color-scheme:dark]"
      >
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.leaguePlayerId} value={option.leaguePlayerId}>
            {option.name}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground"
      />
    </label>
  );
}
