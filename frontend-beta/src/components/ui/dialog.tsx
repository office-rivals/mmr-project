import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

type DialogDismissHandlers = {
  onEscapeKeyDown?: (event: Event) => void;
  onInteractOutside?: (event: Event) => void;
  onPointerDownOutside?: (event: Event) => void;
};

const DialogDismissContext = React.createContext<
  React.MutableRefObject<DialogDismissHandlers> | undefined
>(undefined);

function Dialog({ onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  const dismissHandlers = React.useRef<DialogDismissHandlers>({});

  return (
    <DialogDismissContext.Provider value={dismissHandlers}>
      <DialogPrimitive.Root
        data-slot="dialog"
        onOpenChange={(open, eventDetails) => {
          if (!open) {
            const handlers = dismissHandlers.current;
            if (eventDetails.reason === 'escape-key') {
              handlers.onEscapeKeyDown?.(eventDetails.event);
            } else if (eventDetails.reason === 'outside-press') {
              handlers.onPointerDownOutside?.(eventDetails.event);
              handlers.onInteractOutside?.(eventDetails.event);
            }

            if (eventDetails.event.defaultPrevented) {
              eventDetails.cancel();
              return;
            }
          }

          onOpenChange?.(open, eventDetails);
        }}
        {...props}
      />
    </DialogDismissContext.Provider>
  );
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  DialogPrimitive.Backdrop.Props
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Backdrop
    data-slot="dialog-overlay"
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

type DialogContentProps = DialogPrimitive.Popup.Props & {
  hideCloseButton?: boolean;
  onCloseAutoFocus?: (event: Event) => void;
  onEscapeKeyDown?: (event: Event) => void;
  onInteractOutside?: (event: Event) => void;
  onOpenAutoFocus?: (event: Event) => void;
  onPointerDownOutside?: (event: Event) => void;
};

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  (
    {
      className,
      children,
      finalFocus,
      hideCloseButton = false,
      initialFocus,
      onCloseAutoFocus,
      onEscapeKeyDown,
      onInteractOutside,
      onOpenAutoFocus,
      onPointerDownOutside,
      ...props
    },
    ref
  ) => {
    const dismissHandlers = React.useContext(DialogDismissContext);

    React.useEffect(() => {
      if (!dismissHandlers) return;
      const handlers = {
        onEscapeKeyDown,
        onInteractOutside,
        onPointerDownOutside,
      };
      dismissHandlers.current = handlers;
      return () => {
        if (dismissHandlers.current === handlers) dismissHandlers.current = {};
      };
    }, [
      dismissHandlers,
      onEscapeKeyDown,
      onInteractOutside,
      onPointerDownOutside,
    ]);

    const resolvedInitialFocus = onOpenAutoFocus
      ? () => {
          const event = new Event('dialog.openAutoFocus', {
            cancelable: true,
          });
          onOpenAutoFocus(event);
          return event.defaultPrevented ? false : true;
        }
      : (initialFocus ?? true);

    const resolvedFinalFocus = onCloseAutoFocus
      ? () => {
          const event = new Event('dialog.closeAutoFocus', {
            cancelable: true,
          });
          onCloseAutoFocus(event);
          return event.defaultPrevented ? false : true;
        }
      : finalFocus;

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          ref={ref}
          aria-modal="true"
          initialFocus={resolvedInitialFocus}
          finalFocus={resolvedFinalFocus}
          className={cn(
            'fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 sm:rounded-lg md:w-full',
            className
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Popup>
        {!hideCloseButton ? (
          <DialogPrimitive.Close
            data-dialog-close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-sm bg-accent text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPortal>
    );
  }
);
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-header"
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-footer"
    className={cn(
      'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  DialogPrimitive.Title.Props
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    data-slot="dialog-title"
    ref={ref}
    className={cn(
      'text-lg leading-none font-semibold tracking-tight',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  DialogPrimitive.Description.Props
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    data-slot="dialog-description"
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};

export {
  Dialog as Root,
  DialogPortal as Portal,
  DialogOverlay as Overlay,
  DialogTrigger as Trigger,
  DialogClose as Close,
  DialogContent as Content,
  DialogHeader as Header,
  DialogFooter as Footer,
  DialogTitle as Title,
  DialogDescription as Description,
};
