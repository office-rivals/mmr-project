import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';

import { cn } from '@/lib/utils';

function ToggleGroup({ className, ...props }: ToggleGroupPrimitive.Props) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn('flex gap-3', className)}
      {...props}
    />
  );
}

/** A bordered card that fills with the primary colour while pressed. */
function ToggleGroupItem({ className, ...props }: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        'flex h-14 items-center justify-center rounded-md border bg-card font-semibold transition-colors outline-none not-data-pressed:hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-pressed:border-primary-fill data-pressed:bg-primary-fill data-pressed:text-primary-foreground',
        className
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
