using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.DTOs;

public record PendingMatchDto
{
    public long Id { get; set; }
    public PendingMatchStatus Status { get; set; }
}