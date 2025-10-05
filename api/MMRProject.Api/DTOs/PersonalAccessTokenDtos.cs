namespace MMRProject.Api.DTOs;

public record CreatePersonalAccessTokenRequest(string Name, DateTime? ExpiresAt);

public record PersonalAccessTokenResponse(
    long Id,
    string Name,
    DateTime? LastUsedAt,
    DateTime? ExpiresAt,
    DateTime? CreatedAt);

public record CreatePersonalAccessTokenResponse(
    long Id,
    string Name,
    string Token,
    DateTime? ExpiresAt,
    DateTime? CreatedAt);
