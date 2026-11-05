namespace MMRProject.Api.Data.Entities.V3;

public enum GameInviteStatus
{
    /// <summary>Open for players to join or be added until the roster reaches capacity.</summary>
    Waiting = 0,

    /// <summary>Roster locked; players are accepting the shuffled teams.</summary>
    AwaitingAcceptance = 1,

    /// <summary>Every participant accepted and an active match was created.</summary>
    Started = 2,

    /// <summary>Cancelled, abandoned by the creator, or expired. Commitments are released.</summary>
    Ended = 3
}

public enum GameInviteEndReason
{
    CreatorCancelled = 0,
    CreatorLeft = 1,
    CreatorDeclined = 2,
    CreatorTimedOut = 3,
    Expired = 4
}
