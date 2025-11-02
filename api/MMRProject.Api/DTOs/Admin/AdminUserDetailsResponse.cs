using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.DTOs.Admin;

public record AdminUserDetailsResponse
{
    public long Id { get; init; }
    public string? IdentityUserId { get; init; }
    public string? Email { get; init; }
    public string? Name { get; init; }
    public string? DisplayName { get; init; }
    public long? Mmr { get; init; }
    public decimal? Sigma { get; init; }
    public PlayerRole Role { get; init; }
    public long? RoleAssignedById { get; init; }
    public DateTime? RoleAssignedAt { get; init; }
    public DateTime? CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
    public DateTime? DeletedAt { get; init; }
}
