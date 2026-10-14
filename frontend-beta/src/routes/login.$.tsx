import { SignIn } from '@clerk/tanstack-react-start';
import { createFileRoute } from '@tanstack/react-router';

// Splat route so Clerk's multi-step URLs (/login/factor-one, …) resolve here.
// Keep Clerk's prebuilt <SignIn>: e2e drives input[name=identifier] and
// input[name=password], which only exist on Clerk's own markup.
export const Route = createFileRoute('/login/$')({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn routing="path" path="/login" signUpUrl="/sign-up" />
    </div>
  );
}
