using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.Extensions;
using Npgsql;

namespace MMRProject.Api.Services.V3;

/// <summary>
/// Keyed hash of an NFC card UID: HMAC-SHA256(<c>Hardware:CardUidKey</c>, orgId ‖ UID bytes). Raw UIDs are
/// never stored; the org in the message keeps one badge unlinkable across organizations. The key is
/// deployment config (base64, at least 32 bytes), never in the repo. Rotating it unlinks every card.
/// </summary>
public sealed class CardUidHasher
{
    public const string ConfigKey = "Hardware:CardUidKey";

    private readonly byte[]? key;

    public CardUidHasher(IConfiguration configuration)
    {
        var value = configuration[ConfigKey];
        if (string.IsNullOrEmpty(value))
        {
            return;
        }

        try
        {
            key = Convert.FromBase64String(value);
        }
        catch (FormatException)
        {
        }

        if (key is not { Length: >= 32 })
        {
            throw new InvalidOperationException($"{ConfigKey} must be base64 of at least 32 bytes");
        }
    }

    public bool IsConfigured => key is not null;

    /// <summary>Null when <paramref name="uidHex"/> isn't a 4, 7 or 10 byte UID in hex.</summary>
    public byte[]? Hash(Guid orgId, string uidHex)
    {
        if (key is null)
        {
            throw new InvalidOperationException($"{ConfigKey} is not configured");
        }

        if (uidHex.Length is not (8 or 14 or 20) || !uidHex.All(char.IsAsciiHexDigit))
        {
            return null;
        }

        byte[] message = [..orgId.ToByteArray(), ..Convert.FromHexString(uidHex)];
        return HMACSHA256.HashData(key, message);
    }
}

public interface ICardService
{
    /// <param name="ownerMembershipId">Who the card is for; null = the caller.</param>
    Task<PlayerCardResponse> LinkAsync(Guid orgId, string code, Guid? ownerMembershipId);
    Task<List<PlayerCardResponse>> ListMineAsync(Guid orgId);
    Task DeleteMineAsync(Guid orgId, Guid cardId);
    Task<List<AdminPlayerCardResponse>> ListAsync(Guid orgId, Guid? membershipId);
    Task DeleteAsync(Guid orgId, Guid cardId);
    Task<int> DeleteAllAsync(Guid orgId);
}

public class CardService(
    ApiDbContext dbContext,
    IOrganizationService organizationService,
    ITableMatchService tableMatchService) : ICardService
{
    private const string UniqueCardIndexName = "ix_player_cards_org_uid";

    public async Task<PlayerCardResponse> LinkAsync(Guid orgId, string code, Guid? ownerMembershipId)
    {
        var callerId = await CurrentMembershipIdAsync(orgId);
        var membershipId = ownerMembershipId ?? callerId;
        if (membershipId != callerId && !await dbContext.OrganizationMemberships.AnyAsync(m =>
                m.Id == membershipId && m.OrganizationId == orgId && m.Status == MembershipStatus.Active))
        {
            throw new NotFoundException("Member not found");
        }

        code = ShortCode.Normalize(code);
        var request = await dbContext.CardLinkRequests
                          .FirstOrDefaultAsync(r => r.OrganizationId == orgId && r.ShortCode == code)
                      ?? throw new NotFoundException("Card link not found");

        if (request.ExpiresAt < DateTimeOffset.UtcNow)
        {
            dbContext.CardLinkRequests.Remove(request);
            await dbContext.SaveChangesAsync();
            throw new GoneException("This card link has expired. Scan the card again.");
        }

        var card = await dbContext.PlayerCards
            .FirstOrDefaultAsync(c => c.OrganizationId == orgId && c.UidHmac == request.UidHmac);
        if (card is not null && card.OrganizationMembershipId != membershipId)
        {
            throw new ConflictException("This card is already linked to another player");
        }

        if (card is null)
        {
            card = new PlayerCard
            {
                OrganizationId = orgId,
                OrganizationMembershipId = membershipId,
                UidHmac = request.UidHmac,
                LinkedByMembershipId = callerId,
            };
            dbContext.PlayerCards.Add(card);
        }

        dbContext.CardLinkRequests.Remove(request);
        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                                           {
                                               SqlState: PostgresErrorCodes.UniqueViolation,
                                               ConstraintName: UniqueCardIndexName
                                           })
        {
            throw new ConflictException("This card is already linked to another player");
        }

        // The card was tapped at a table to join its next game: its owner joins now.
        var rosterResult = await tableMatchService.JoinRosterAsync(request.TableId, membershipId);
        var linked = await CardsQuery().FirstAsync(c => c.Id == card.Id);
        return MapCard(linked) with { RosterResult = rosterResult };
    }

    public async Task<List<PlayerCardResponse>> ListMineAsync(Guid orgId)
    {
        var membershipId = await CurrentMembershipIdAsync(orgId);
        var cards = await CardsQuery()
            .Where(c => c.OrganizationId == orgId && c.OrganizationMembershipId == membershipId)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();
        return cards.Select(MapCard).ToList();
    }

    public async Task DeleteMineAsync(Guid orgId, Guid cardId)
    {
        var membershipId = await CurrentMembershipIdAsync(orgId);
        var deleted = await dbContext.PlayerCards
            .Where(c => c.Id == cardId && c.OrganizationId == orgId && c.OrganizationMembershipId == membershipId)
            .ExecuteDeleteAsync();
        if (deleted == 0)
        {
            throw new NotFoundException("Card not found");
        }
    }

    public async Task<List<AdminPlayerCardResponse>> ListAsync(Guid orgId, Guid? membershipId)
    {
        var cards = await CardsQuery()
            .Where(c => c.OrganizationId == orgId &&
                        (membershipId == null || c.OrganizationMembershipId == membershipId))
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        return cards.Select(c => new AdminPlayerCardResponse
        {
            Id = c.Id,
            MembershipId = c.OrganizationMembershipId,
            DisplayName = c.OrganizationMembership.GetDisplayName(),
            Username = c.OrganizationMembership.GetUsername(),
            LinkedBy = MapLinkedBy(c),
            CreatedAt = c.CreatedAt,
        }).ToList();
    }

    public async Task DeleteAsync(Guid orgId, Guid cardId)
    {
        var deleted = await dbContext.PlayerCards
            .Where(c => c.Id == cardId && c.OrganizationId == orgId)
            .ExecuteDeleteAsync();
        if (deleted == 0)
        {
            throw new NotFoundException("Card not found");
        }
    }

    public async Task<int> DeleteAllAsync(Guid orgId)
    {
        await dbContext.CardLinkRequests.Where(r => r.OrganizationId == orgId).ExecuteDeleteAsync();
        return await dbContext.PlayerCards.Where(c => c.OrganizationId == orgId).ExecuteDeleteAsync();
    }

    private async Task<Guid> CurrentMembershipIdAsync(Guid orgId) =>
        (await organizationService.GetMembershipForCurrentUserAsync(orgId) is { Status: MembershipStatus.Active } m
            ? m.Id
            : throw new ForbiddenException("You are not an active member of this organization"));

    private IQueryable<PlayerCard> CardsQuery() => dbContext.PlayerCards.AsNoTracking()
        .Include(c => c.OrganizationMembership).ThenInclude(m => m.User)
        .Include(c => c.LinkedByMembership).ThenInclude(m => m!.User);

    private static PlayerCardResponse MapCard(PlayerCard card) =>
        new() { Id = card.Id, CreatedAt = card.CreatedAt, LinkedBy = MapLinkedBy(card) };

    // Only someone else: a card linked by its owner shows no "linked by".
    private static CardLinkedByResponse? MapLinkedBy(PlayerCard card) =>
        card.LinkedByMembership is { } by && by.Id != card.OrganizationMembershipId
        ? new CardLinkedByResponse { MembershipId = by.Id, DisplayName = by.GetDisplayName(), Username = by.GetUsername() }
        : null;
}
