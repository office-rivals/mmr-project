using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace MMRProject.Api.Data.Entities;

[Index(nameof(TokenHash))]
public class PersonalAccessToken
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public byte[] TokenHash { get; set; } = [];

    [StringLength(64)]
    public string Name { get; set; } = string.Empty;

    public DateTime? LastUsedAt { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Player? Player { get; set; }
}
