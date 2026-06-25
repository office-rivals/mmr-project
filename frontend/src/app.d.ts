// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
/// <reference types="svelte-clerk/env" />

import type { ApiClientV3 } from '$lib/server/api/apiClientV3';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      apiClientV3: ApiClientV3;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
