import type { RosterResult } from './api';

/**
 * What linking did at the table: it also scans the badge's owner in.
 * `who` is null for "you", else the other player's name.
 */
export function rosterMessage(
  result: RosterResult,
  table: string,
  who: string | null
) {
  const is = who ? `${who} is` : "You're";
  switch (result) {
    case 'Joined':
      return `${is} in the game on ${table}.`;
    case 'AlreadyIn':
      return `${is} already in the game on ${table}.`;
    case 'RosterFull':
      return `The game on ${table} is full. Remove a player on the scoreboard, then tap the badge.`;
    case 'Locked':
      return `A game is on at ${table}. Tap the badge when it's over.`;
    case 'Busy':
      return `${is} playing at another table, so ${who ? 'they' : 'you'} didn't join ${table}.`;
    case 'NoLeague':
      return `${table} has no league yet, so nobody can join a game there.`;
  }
}
