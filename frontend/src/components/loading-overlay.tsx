import { LoaderCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  onOpenChange?: (open: boolean) => void;
}

export function LoadingOverlay({
  isLoading,
  message,
  onOpenChange,
}: LoadingOverlayProps) {
  return (
    <Dialog open={isLoading} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="loading-dialog flex flex-col items-center justify-center"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{message ?? 'Loading'}</DialogTitle>
        {message ? message : null}
        <LoaderCircle className="animate-spin" />
      </DialogContent>
    </Dialog>
  );
}
