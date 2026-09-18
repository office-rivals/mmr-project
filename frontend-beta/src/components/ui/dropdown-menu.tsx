import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

import { cn } from '@/lib/utils';

interface DropdownMenuContextValue {
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  tabTargetRef: React.MutableRefObject<HTMLElement | null>;
}

const DropdownMenuContext =
  React.createContext<DropdownMenuContextValue | null>(null);

function DropdownMenu({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false
  );
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const tabTargetRef = React.useRef<HTMLElement>(null);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange]
  );

  return (
    <DropdownMenuContext.Provider value={{ setOpen, triggerRef, tabTargetRef }}>
      <DropdownMenuPrimitive.Root
        {...props}
        open={open}
        onOpenChange={setOpen}
      />
    </DropdownMenuContext.Provider>
  );
}

const DropdownMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>((props, forwardedRef) => {
  const context = React.useContext(DropdownMenuContext);
  return (
    <DropdownMenuPrimitive.Trigger
      {...props}
      ref={(node) => {
        if (context) context.triggerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
    />
  );
});
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName;

const DropdownMenuGroupContext = React.createContext<string | null>(null);

const DropdownMenuGroup = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Group>
>(({ 'aria-labelledby': ariaLabelledBy, ...props }, ref) => {
  const generatedLabelId = React.useId();
  const labelId = ariaLabelledBy ?? generatedLabelId;
  return (
    <DropdownMenuGroupContext.Provider value={labelId}>
      <DropdownMenuPrimitive.Group
        ref={ref}
        aria-labelledby={labelId}
        {...props}
      />
    </DropdownMenuGroupContext.Provider>
  );
});
DropdownMenuGroup.displayName = DropdownMenuPrimitive.Group.displayName;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const tabbableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function adjacentTabTarget(trigger: HTMLElement, reverse: boolean) {
  const candidates = Array.from(
    trigger.ownerDocument.querySelectorAll<HTMLElement>(tabbableSelector)
  ).filter(
    (element) =>
      element.getClientRects().length > 0 &&
      element.getAttribute('aria-disabled') !== 'true'
  );
  const ordered = reverse ? candidates.reverse() : candidates;
  const triggerIndex = ordered.indexOf(trigger);
  return triggerIndex < 0 ? null : (ordered[triggerIndex + 1] ?? null);
}

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(
  (
    { className, sideOffset = 6, onKeyDown, onCloseAutoFocus, ...props },
    ref
  ) => {
    const context = React.useContext(DropdownMenuContext);
    return (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn(
            'z-50 rounded-md border border-muted bg-popover p-1 text-popover-foreground shadow-lg focus:outline-none',
            className
          )}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || event.key !== 'Tab' || !context) {
              return;
            }
            event.preventDefault();
            context.tabTargetRef.current = context.triggerRef.current
              ? adjacentTabTarget(context.triggerRef.current, event.shiftKey)
              : null;
            context.setOpen(false);
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            const target = context?.tabTargetRef.current;
            if (!target) return;
            event.preventDefault();
            context.tabTargetRef.current = null;
            requestAnimationFrame(() => target.focus());
          }}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    );
  }
);
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-muted data-[disabled]:opacity-50',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuGroupHeading = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, id, ...props }, ref) => {
  const groupLabelId = React.useContext(DropdownMenuGroupContext);
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      id={id ?? groupLabelId ?? undefined}
      className={cn(
        'flex items-center gap-2 px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className
      )}
      {...props}
    />
  );
});
DropdownMenuGroupHeading.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('my-1 h-px bg-muted', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuLabel = DropdownMenuGroupHeading;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroupHeading,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};

export {
  DropdownMenu as Root,
  DropdownMenuTrigger as Trigger,
  DropdownMenuGroup as Group,
  DropdownMenuPortal as Portal,
  DropdownMenuContent as Content,
  DropdownMenuItem as Item,
  DropdownMenuGroupHeading as GroupHeading,
  DropdownMenuSeparator as Separator,
};
