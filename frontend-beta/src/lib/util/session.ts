export const getRandomTeamsSessionStorageKey = (players: string[]) =>
  [...players].sort().join('+');
