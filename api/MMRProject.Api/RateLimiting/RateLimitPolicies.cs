namespace MMRProject.Api.RateLimiting;

public static class RateLimitPolicies
{
    // Invite codes are guessable secrets and the lookup endpoint is an
    // enumeration oracle, so throttle attempts per user to keep brute force
    // impractical independent of code length.
    public const string InviteLookup = "invite-lookup";
}
