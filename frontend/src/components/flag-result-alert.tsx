import { AlertCircle, CheckCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import type { FlagActionResult } from '@/lib/match-flag-actions';

export function FlagResultAlert({
  result,
}: {
  result: FlagActionResult | null;
}) {
  if (result?.success && result.message) {
    return (
      <Alert variant="default">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          <span className="font-medium">{result.message}</span>
        </div>
      </Alert>
    );
  }
  if (result?.success === false) {
    return (
      <Alert variant="destructive">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="font-medium">{result.message}</span>
        </div>
      </Alert>
    );
  }
  return null;
}
