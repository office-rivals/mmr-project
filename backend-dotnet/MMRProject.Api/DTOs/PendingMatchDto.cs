using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.DTOs;

public record PendingMatchDto
{
    [Required]
    public Guid Id { get; set; }

    [Required]
    public PendingMatchStatus Status { get; set; }
}