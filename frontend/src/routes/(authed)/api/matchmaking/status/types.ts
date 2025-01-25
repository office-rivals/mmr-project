import type { ActiveMatchDto, MatchMakingQueueStatus, UserDetails } from '$api';

export interface ActiveMatchWithUsers extends ActiveMatchDto {
  users: UserDetails[];
}

export interface TweakedMatchMakingQueueStatus
  extends Omit<MatchMakingQueueStatus, 'assignedActiveMatch'> {
  assignedActiveMatch?: ActiveMatchWithUsers;
}
