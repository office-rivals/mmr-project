import { ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
          className="min-h-11 rounded-full px-2 py-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:min-h-0"
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
  // The null item is "any", so clearing shows its label rather than a blank.
  const items = [
    { value: null, label: anyLabel },
    ...options.map((option) => ({
      value: option.leaguePlayerId,
      label: option.name,
    })),
  ];
  return (
    <Select
      items={items}
      value={value ?? null}
      onValueChange={(id) => onChange(id ?? undefined)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={label}
        icon={<ChevronDown className="size-4 text-muted-foreground" />}
        className="h-auto min-h-11 w-auto max-w-full min-w-0 justify-start gap-1.5 rounded-full border-border bg-card py-1.5 pr-2.5 pl-3 focus-visible:ring-offset-0 disabled:opacity-60 lg:h-auto lg:min-h-0"
      >
        <span aria-hidden="true" className="text-muted-foreground">
          {label}
        </span>
        <SelectValue className="max-w-40 min-w-0 font-medium" />
      </SelectTrigger>
      <SelectContent align="start" sideOffset={6}>
        {items.map((item) => (
          <SelectItem key={item.value ?? ''} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
