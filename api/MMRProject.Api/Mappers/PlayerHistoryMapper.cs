using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;

namespace MMRProject.Api.Mappers;

public static class PlayerHistoryMapper
{
    public static PlayerHistoryDetails MapPlayerHistoryToPlayerHistoryDetails(PlayerHistory playerHistory)
    {
        return new PlayerHistoryDetails
        {
            UserId = playerHistory.PlayerId ?? 0, // TODO: Fix this
            Name = playerHistory.Player?.Name ?? string.Empty, // TODO: Fix this
            Date = playerHistory.Match?.CreatedAt ?? DateTimeOffset.UtcNow, // TODO: Fix this
            MMR = playerHistory.Mmr ?? 0, // TODO: Fix this
        };
    }
}