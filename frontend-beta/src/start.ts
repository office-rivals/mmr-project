import { createStart } from '@tanstack/react-start';
import { clerkMiddleware } from '@clerk/tanstack-react-start/server';
import { authGuardMiddleware } from './lib/server/authGuard';

// Order mirrors the SvelteKit `sequence(withClerkHandler(), authGuard, …)`:
// Clerk resolves the session (and may short-circuit with its handshake
// redirect) before the guard can read `userId`.
export const startInstance = createStart(() => ({
  requestMiddleware: [clerkMiddleware(), authGuardMiddleware],
}));
