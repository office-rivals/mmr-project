import * as React from 'react';
import { ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The browser's own `<select>`, styled like `SelectTrigger`. For forms that
 * must work before (or without) JavaScript, where Select can't open.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <div
      data-slot="native-select-wrapper"
      className={cn(
        'relative w-full has-[select:disabled]:opacity-50',
        className
      )}
    >
      <select
        data-slot="native-select"
        // The browser's list follows the page theme rather than the OS one.
        className="flex h-11 w-full appearance-none rounded-md border border-input bg-background py-2 pr-9 pl-3 text-sm text-foreground [color-scheme:light] ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed lg:h-10 dark:[color-scheme:dark]"
        {...props}
      />
      <ChevronsUpDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
