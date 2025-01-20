import type { LeaderboardEntry } from '../../../api';

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number;
}
