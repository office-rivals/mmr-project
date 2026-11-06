import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const SHOW_MMR_KEY = 'show-mmr';

export const showMmr = writable<boolean>(
  browser ? window.localStorage.getItem(SHOW_MMR_KEY) === 'true' : false
);

showMmr.subscribe((value) => {
  if (browser) {
    window.localStorage.setItem(SHOW_MMR_KEY, value.toString());
  }
});
