// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

import type { ApiClient } from '$lib/server/api/apiClient';
import type { Session } from '@auth/sveltekit';

interface ExtendedSession extends Session {
  accessToken?: string;
}

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      session: ExtendedSession | null;
      apiClient: ApiClient;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
