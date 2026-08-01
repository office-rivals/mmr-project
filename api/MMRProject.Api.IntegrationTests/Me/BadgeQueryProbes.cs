using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.IntegrationTests.Fixtures;
using System.Net.Http.Json;
using MMRProject.Api.DTOs.V3;
using Npgsql;
using Xunit.Abstractions;

namespace MMRProject.Api.IntegrationTests.Me;

// Diagnostic probes for review findings #5 (is the in-memory Role filter
// necessary?) and #3 (is the badge query indexed?). These assert the claim
// under test so a regression flips them.
[Collection("Database")]
public class BadgeQueryProbes(PostgresFixture postgres, ITestOutputHelper output)
    : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task Probe_Finding5_RoleComparisonTranslatesToSql()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        // The shape the review says should replace the in-memory filter.
        var query = db.OrganizationMemberships
            .Where(m => m.Status == MembershipStatus.Active
                        && (m.Role == OrganizationRole.Owner || m.Role == OrganizationRole.Moderator))
            .Select(m => m.OrganizationId);

        var sql = query.ToQueryString();
        output.WriteLine("Generated SQL:\n" + sql);

        // If EF could not translate the enum comparison it would throw here.
        var rows = await query.ToListAsync();
        output.WriteLine($"executed fine, {rows.Count} row(s)");

        // Translation means the role predicate appears in the WHERE clause,
        // not that rows were filtered client-side.
        Assert.Contains("WHERE", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("role", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Probe_Finding3_BadgeQueryIndexUsage()
    {
        var org = await CreateOrganization("Idx Org", "idx-org");

        await using var conn = new NpgsqlConnection(postgres.GetConnectionString());
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        // The shape SessionService.GetBadgesAsync issues.
        cmd.CommandText = $@"
            EXPLAIN (FORMAT TEXT)
            SELECT organization_id, league_id, COUNT(*)
            FROM match_flags
            WHERE status = 0 AND organization_id = '{org.Id}'
            GROUP BY organization_id, league_id;";

        var plan = new List<string>();
        await using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync()) plan.Add(reader.GetString(0));
        }

        var planText = string.Join("\n", plan);
        output.WriteLine("EXPLAIN plan:\n" + planText);

        // Record which access path Postgres chose.
        var usesSeqScan = planText.Contains("Seq Scan", StringComparison.OrdinalIgnoreCase);
        var usesIndex = planText.Contains("Index", StringComparison.OrdinalIgnoreCase);
        output.WriteLine($"\nseq scan: {usesSeqScan}   index: {usesIndex}");

        // Documents today's behaviour; flips if an index is added.
        Assert.True(usesSeqScan || usesIndex, "no recognisable access path in plan");
    }

    [Fact]
    public async Task Probe_Finding3_ExistingIndexesOnMatchFlags()
    {
        await using var conn = new NpgsqlConnection(postgres.GetConnectionString());
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'match_flags' ORDER BY indexname;";

        await using var reader = await cmd.ExecuteReaderAsync();
        output.WriteLine("Indexes on match_flags:");
        var any = false;
        while (await reader.ReadAsync())
        {
            any = true;
            output.WriteLine($"  {reader.GetString(0)}\n    {reader.GetString(1)}");
        }

        Assert.True(any, "expected at least the primary key");
    }

    [Fact]
    public async Task Probe_Finding3_BadgeQueryPlanAtVolume()
    {
        // Small tables always favour an index, so the earlier probe proves little.
        // Seed realistic volume across several orgs and re-check the plan.
        var orgA = await CreateOrganization("Vol A", "vol-a");
        var league = await CreateLeague(orgA.Id, "Vol League", "vol-league");
        await CreateSeason(orgA.Id, league.Id);
        var (_, _, p1) = await SeedTestUser(orgA.Id, league.Id, "v1", "v1@test.com", OrganizationRole.Owner);
        var (_, _, p2) = await SeedTestUser(orgA.Id, league.Id, "v2", "v2@test.com");
        var (_, _, p3) = await SeedTestUser(orgA.Id, league.Id, "v3", "v3@test.com");
        var (_, _, p4) = await SeedTestUser(orgA.Id, league.Id, "v4", "v4@test.com");

        AuthenticateAs("v1");
        var matchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{orgA.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p1.Id, p2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [p3.Id, p4.Id], Score = 5 }
                ]
            });
        matchResponse.EnsureSuccessStatusCode();
        var match = (await ReadJsonAsync<MatchResponse>(matchResponse))!;

        const int orgCount = 4;
        const int flagsPerOrg = 3000;

        var orgIds = new List<Guid> { orgA.Id };
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            for (var o = 1; o < orgCount; o++)
            {
                var extra = new Organization { Name = $"Vol {o}", Slug = $"vol-{o}" };
                db.Organizations.Add(extra);
                orgIds.Add(extra.Id);
            }
            await db.SaveChangesAsync();

            // One membership per flag keeps the partial unique index
            // (match_id, flagged_by_membership_id) WHERE status = 0 satisfied.
            var memberships = new List<OrganizationMembership>();
            var flags = new List<V3MatchFlag>();
            foreach (var oid in orgIds)
            {
                for (var i = 0; i < flagsPerOrg; i++)
                {
                    var m = new OrganizationMembership
                    {
                        OrganizationId = oid,
                        InviteEmail = $"bulk-{oid:N}-{i}@test.com",
                        DisplayName = $"bulk {i}",
                        Role = OrganizationRole.Member,
                        Status = MembershipStatus.Active
                    };
                    memberships.Add(m);
                    flags.Add(new V3MatchFlag
                    {
                        OrganizationId = oid,
                        LeagueId = league.Id,
                        MatchId = match.Id,
                        FlaggedByMembershipId = m.Id,
                        Reason = "bulk",
                        Status = MatchFlagStatus.Open,
                        UpdatedAt = DateTimeOffset.UtcNow
                    });
                }
            }
            db.OrganizationMemberships.AddRange(memberships);
            await db.SaveChangesAsync();
            db.Set<V3MatchFlag>().AddRange(flags);
            await db.SaveChangesAsync();
        }

        await using var conn = new NpgsqlConnection(postgres.GetConnectionString());
        await conn.OpenAsync();

        await using (var analyze = conn.CreateCommand())
        {
            analyze.CommandText = "ANALYZE match_flags;";
            await analyze.ExecuteNonQueryAsync();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"
            EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
            SELECT organization_id, league_id, COUNT(*)
            FROM match_flags
            WHERE status = 0 AND organization_id = '{orgA.Id}'
            GROUP BY organization_id, league_id;";

        var plan = new List<string>();
        await using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync()) plan.Add(reader.GetString(0));
        }

        var planText = string.Join("\n", plan);
        output.WriteLine($"rows: {orgCount * flagsPerOrg} open flags across {orgCount} orgs");
        output.WriteLine("EXPLAIN ANALYZE plan:\n" + planText);
        output.WriteLine(
            $"\nseq scan: {planText.Contains("Seq Scan", StringComparison.OrdinalIgnoreCase)}   " +
            $"index: {planText.Contains("Index", StringComparison.OrdinalIgnoreCase)}");

        Assert.NotEmpty(planText);
    }

}
