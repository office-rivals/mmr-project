using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.DTOs;

public record PendingMatchDto
{
    public Guid Id { get; set; }
    public PendingMatchStatus Status { get; set; }
}