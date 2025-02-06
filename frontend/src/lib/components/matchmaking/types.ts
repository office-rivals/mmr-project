import type { ActiveMatchWithUsers } from '../../../routes/(authed)/api/matchmaking/status/types';

export type MatchMakingStateQueued = { type: 'queued'; playersInQueue: number };
export type MatchMakingStatePendingMatch = {
  type: 'pending-match';
  pendingMatchId: string;
  expiresAt: Date;
  hasBeenAccepted: boolean;
};
export type MatchMakingStateActiveMatch = {
  type: 'active-match';
  activeMatch: ActiveMatchWithUsers;
};
export type MatchMakingState =
  | { type: 'inactive' }
  | MatchMakingStateQueued
  | MatchMakingStatePendingMatch
  | MatchMakingStateActiveMatch;
