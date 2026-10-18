import { SignIn } from '@clerk/tanstack-react-start';
import { createFileRoute } from '@tanstack/react-router';
import { safeRedirectPath } from '@/lib/safe-redirect';

// Splat route so Clerk's multi-step URLs (/login/factor-one, …) resolve here.
// Keep Clerk's prebuilt <SignIn>: e2e drives input[name=identifier] and
// input[name=password], which only exist on Clerk's own markup.
export const Route = createFileRoute('/login/$')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_url:
      typeof search.redirect_url === 'string' ? search.redirect_url : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect_url } = Route.useSearch();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/sign-up"
        // Takes precedence over Clerk's own `redirect_url` handling, so only
        // the sanitised same-origin path is ever followed.
        forceRedirectUrl={
          redirect_url === undefined
            ? undefined
            : safeRedirectPath(redirect_url)
        }
      />
    </div>
  );
}
