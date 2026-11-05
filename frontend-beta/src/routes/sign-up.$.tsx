import { SignUp } from '@clerk/tanstack-react-start';
import { createFileRoute } from '@tanstack/react-router';
import { safeInviteReturnPath } from '@/lib/game-invite';

export const Route = createFileRoute('/sign-up/$')({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: safeInviteReturnPath(search.returnTo) ?? undefined,
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const { returnTo } = Route.useSearch();
  const signInUrl = returnTo
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : '/login';
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl={signInUrl}
        // ClerkProvider forces both redirects to `/`; a forced value outranks a
        // fallback, so the invite path must be forced here to win.
        forceRedirectUrl={returnTo ?? '/'}
        signInForceRedirectUrl={returnTo ?? '/'}
      />
    </div>
  );
}
