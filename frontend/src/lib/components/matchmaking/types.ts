import type { ActiveMatchWithUsers } from '../../../routes/(authed)/api/matchmaking/status/types';

export type MatchMakingState =
  | { type: 'inactive' }
  | { type: 'queued'; playersInQueue: number }
  | { type: 'pending-match'; pendingMatchId: string; expiresAt: Date }
  | {
      type: 'match-accepted';
      pendingMatchId: string;
      expiresAt: Date;
    }
  | {
      type: 'active-match';
      activeMatch: ActiveMatchWithUsers;
    };
