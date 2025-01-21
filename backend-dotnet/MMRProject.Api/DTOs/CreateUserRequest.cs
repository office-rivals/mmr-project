using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record CreateUserRequest
{
    [Required]
    public required string Name { get; set; }
    public string? DisplayName { get; set; }
}