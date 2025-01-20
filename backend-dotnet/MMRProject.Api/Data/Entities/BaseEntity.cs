using UUIDNext;

namespace MMRProject.Api.Data.Entities;

public class BaseEntity
{
    public Guid Id { get; set; } = Uuid.NewDatabaseFriendly(Database.PostgreSql);

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}