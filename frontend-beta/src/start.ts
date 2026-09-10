import { createCsrfMiddleware, createStart } from '@tanstack/react-start';
import { clerkMiddleware } from '@clerk/tanstack-react-start/server';
import { authGuardMiddleware } from './lib/server/authGuard';

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
});

// Clerk must resolve the session before the guard can read `userId`.
export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, clerkMiddleware(), authGuardMiddleware],
}));
