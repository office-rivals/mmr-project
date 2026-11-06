import { createCsrfMiddleware, createStart } from '@tanstack/react-start';
import { clerkMiddleware } from '@clerk/tanstack-react-start/server';
import { authGuardMiddleware } from './lib/server/authGuard';
import { clerkAuthorizedParties } from './lib/server/clerk-options';

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
});

// Clerk must resolve the session before the guard can read `userId`.
export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    clerkMiddleware({
      authorizedParties: clerkAuthorizedParties(
        process.env.CLERK_AUTHORIZED_PARTIES
      ),
    }),
    authGuardMiddleware,
  ],
}));
