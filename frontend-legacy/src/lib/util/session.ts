export const getRandomTeamsSessionStorageKey = (players: string[]) =>
  players.toSorted().join('+');
