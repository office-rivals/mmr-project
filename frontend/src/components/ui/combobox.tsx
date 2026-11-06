import * as React from 'react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const Combobox = ComboboxPrimitive.Root;

const ComboboxInput = React.forwardRef<
  HTMLInputElement,
  ComboboxPrimitive.Input.Props
>((props, ref) => (
  <ComboboxPrimitive.Input
    data-slot="combobox-input"
    ref={ref}
    render={<Input />}
    {...props}
  />
));
ComboboxInput.displayName = 'ComboboxInput';

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn('flex flex-col gap-1', className)}
      {...props}
    />
  );
}

function ComboboxItem({ className, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        'flex w-full cursor-pointer flex-col gap-1 rounded-md border border-input px-3 py-2 text-start select-none hover:border-primary data-highlighted:border-primary data-highlighted:bg-muted',
        className
      )}
      {...props}
    />
  );
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn('flex flex-col gap-1', className)}
      {...props}
    />
  );
}

function ComboboxLabel({
  className,
  ...props
}: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Combobox,
  ComboboxInput,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
};
