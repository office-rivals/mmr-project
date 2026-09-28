import * as React from 'react';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

import { cn } from '@/lib/utils';

interface DropdownMenuContextValue {
  requestClose: () => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  tabTargetRef: React.MutableRefObject<HTMLElement | null>;
}

const DropdownMenuContext =
  React.createContext<DropdownMenuContextValue | null>(null);

function DropdownMenu({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  actionsRef: externalActionsRef,
  ...props
}: MenuPrimitive.Root.Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false
  );
  const triggerRef = React.useRef<HTMLElement>(null);
  const tabTargetRef = React.useRef<HTMLElement>(null);
  const internalActionsRef = React.useRef<MenuPrimitive.Root.Actions>(null);
  const actionsRef = externalActionsRef ?? internalActionsRef;
  const open = controlledOpen ?? uncontrolledOpen;
  const requestClose = React.useCallback(
    () => actionsRef.current?.close(),
    [actionsRef]
  );

  return (
    <DropdownMenuContext.Provider
      value={{ requestClose, triggerRef, tabTargetRef }}
    >
      <MenuPrimitive.Root
        data-slot="dropdown-menu"
        {...props}
        actionsRef={actionsRef}
        open={open}
        onOpenChange={(nextOpen, eventDetails) => {
          if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
          onOpenChange?.(nextOpen, eventDetails);
        }}
      />
    </DropdownMenuContext.Provider>
  );
}

const DropdownMenuTrigger = React.forwardRef<
  HTMLElement,
  MenuPrimitive.Trigger.Props
>((props, forwardedRef) => {
  const context = React.useContext(DropdownMenuContext);
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
      ref={(node: HTMLElement | null) => {
        if (context) context.triggerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
    />
  );
});
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

function DropdownMenuPortal(props: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

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

type DropdownMenuContentProps = MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  > & {
    onCloseAutoFocus?: (event: Event) => void;
  };

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(
  (
    {
      align = 'start',
      alignOffset = 0,
      className,
      finalFocus,
      onCloseAutoFocus,
      onKeyDown,
      side = 'bottom',
      sideOffset = 6,
      ...props
    },
    ref
  ) => {
    const context = React.useContext(DropdownMenuContext);

    return (
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          className="isolate z-50 outline-none"
          align={align}
          alignOffset={alignOffset}
          side={side}
          sideOffset={sideOffset}
        >
          <MenuPrimitive.Popup
            data-slot="dropdown-menu-content"
            ref={ref}
            className={cn(
              'z-50 rounded-md border border-muted bg-popover p-1 text-popover-foreground shadow-lg focus:outline-none',
              className
            )}
            finalFocus={(closeType) => {
              const target = context?.tabTargetRef.current;
              if (target && context) {
                context.tabTargetRef.current = null;
                return target;
              }

              if (onCloseAutoFocus) {
                const event = new Event('menu.closeAutoFocus', {
                  cancelable: true,
                });
                onCloseAutoFocus(event);
                if (event.defaultPrevented) return false;
              }

              if (finalFocus === undefined) return true;
              if (typeof finalFocus === 'function')
                return finalFocus(closeType);
              if (typeof finalFocus === 'object') return finalFocus.current;
              return finalFocus;
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (event.defaultPrevented || event.key !== 'Tab' || !context) {
                return;
              }
              event.preventDefault();
              event.preventBaseUIHandler();
              context.tabTargetRef.current = context.triggerRef.current
                ? adjacentTabTarget(context.triggerRef.current, event.shiftKey)
                : null;
              context.requestClose();
            }}
            {...props}
          />
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    );
  }
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

const DropdownMenuGroup = React.forwardRef<
  HTMLDivElement,
  MenuPrimitive.Group.Props
>((props, ref) => (
  <MenuPrimitive.Group data-slot="dropdown-menu-group" ref={ref} {...props} />
));
DropdownMenuGroup.displayName = 'DropdownMenuGroup';

type DropdownMenuItemProps = Omit<
  MenuPrimitive.Item.Props,
  'className' | 'onClick'
> & {
  className?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onSelect?: (event: Event) => void;
};

const DropdownMenuItem = React.forwardRef<HTMLElement, DropdownMenuItemProps>(
  ({ className, onClick, onSelect, ...props }, ref) => (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      ref={ref}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted',
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) {
          event.preventBaseUIHandler();
          return;
        }

        if (onSelect) {
          const selectEvent = new Event('menu.select', { cancelable: true });
          onSelect(selectEvent);
          if (selectEvent.defaultPrevented) event.preventBaseUIHandler();
        }
      }}
      {...props}
    />
  )
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuGroupHeading = React.forwardRef<
  HTMLDivElement,
  MenuPrimitive.GroupLabel.Props
>(({ className, ...props }, ref) => (
  <MenuPrimitive.GroupLabel
    data-slot="dropdown-menu-label"
    ref={ref}
    className={cn(
      'flex items-center gap-2 px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase',
      className
    )}
    {...props}
  />
));
DropdownMenuGroupHeading.displayName = 'DropdownMenuGroupHeading';

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  MenuPrimitive.Separator.Props
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Separator
    data-slot="dropdown-menu-separator"
    ref={ref}
    className={cn('my-1 h-px bg-muted', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

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
