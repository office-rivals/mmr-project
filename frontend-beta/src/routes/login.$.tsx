import { SignIn } from '@clerk/tanstack-react-start';
import { createFileRoute } from '@tanstack/react-router';
import { safeInviteReturnPath } from '@/lib/game-invite';

// Splat route so Clerk's multi-step URLs (/login/factor-one, …) resolve here.
// Keep Clerk's prebuilt <SignIn>: e2e drives input[name=identifier] and
// input[name=password], which only exist on Clerk's own markup.
export const Route = createFileRoute('/login/$')({
  validateSearch: (search: Record<string, unknown>) => ({
    // Only a game invite link is honoured; anything else falls back to home.
    returnTo: safeInviteReturnPath(search.returnTo) ?? undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { returnTo } = Route.useSearch();
  const signUpUrl = returnTo
    ? `/sign-up?returnTo=${encodeURIComponent(returnTo)}`
    : '/sign-up';
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn
        routing="path"
        path="/login"
        signUpUrl={signUpUrl}
        fallbackRedirectUrl={returnTo ?? '/'}
      />
    </div>
  );
}
