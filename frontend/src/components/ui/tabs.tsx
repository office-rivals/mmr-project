import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col', className)}
      {...props}
    />
  );
}

/** A pill-shaped segmented control. */
function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex shrink-0 items-center gap-0.5 rounded-full border bg-background p-0.5 text-xs',
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-full px-3 text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring data-active:bg-muted data-active:font-semibold data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
