// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
/// <reference types="svelte-clerk/env" />

import type { ApiClient } from '$lib/server/api/apiClient';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      apiClient: ApiClient;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
