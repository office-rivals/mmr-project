import type * as React from 'react';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Check, ChevronsDown, ChevronsUp, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn('truncate', className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  children,
  icon = <ChevronsUpDown className="size-4 text-muted-foreground" />,
  ...props
}: SelectPrimitive.Trigger.Props & { icon?: React.ReactElement }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 lg:h-10',
        className
      )}
      {...props}
    >
      {children}
      {/* As children: through `render`, Base UI's default "▼" text would
          land inside the svg. */}
      <SelectPrimitive.Icon className="flex shrink-0">
        {icon}
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 18,
  align = 'end',
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, 'side' | 'sideOffset' | 'align'>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignItemWithTrigger={false}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'relative flex max-h-[min(24rem,var(--available-height))] w-max min-w-(--anchor-width) flex-col overflow-hidden rounded-md border border-muted bg-background shadow-lg focus:outline-none',
            className
          )}
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow className="top-0 z-10 flex w-full cursor-default items-center justify-center bg-background py-1">
            <ChevronsUp className="size-3 text-muted-foreground" />
          </SelectPrimitive.ScrollUpArrow>
          <SelectPrimitive.List className="scroll-py-6 overflow-y-auto p-1">
            {children}
          </SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow className="bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-background py-1">
            <ChevronsDown className="size-3 text-muted-foreground" />
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'flex h-10 w-full cursor-default items-center justify-between gap-2 rounded-md px-3 py-2 text-sm outline-none select-none hover:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground data-selected:bg-accent data-selected:text-accent-foreground',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check className="mr-1 size-4 text-ring" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
