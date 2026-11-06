import { browser } from '$app/environment';
import { getRandomTeamsSessionStorageKey } from '$lib/util/session';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
  const players = url.searchParams.getAll('player');

  let teams: string[][] = [];

  if (browser) {
    const teamsJson = sessionStorage.getItem(
      getRandomTeamsSessionStorageKey(players)
    );
    if (teamsJson) {
      teams = JSON.parse(teamsJson) as string[][];
    }
  }

  return {
    players,
    teams,
  };
};
