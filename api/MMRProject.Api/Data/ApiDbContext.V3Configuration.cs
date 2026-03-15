using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Data;

public partial class ApiDbContext
{
    private static void ConfigureV3Entities(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.IdentityUserId).HasColumnName("identity_user_id");
            entity.Property(e => e.Email).HasColumnName("email");
            entity.Property(e => e.Username).HasColumnName("username");
            entity.Property(e => e.DisplayName).HasColumnName("display_name");
            entity.Property(e => e.LegacyPlayerId).HasColumnName("legacy_player_id");

            entity.HasIndex(e => e.IdentityUserId, "ix_users_identity_user_id").IsUnique();
            entity.HasIndex(e => e.Email, "ix_users_email");
        });

        modelBuilder.Entity<Organization>(entity =>
        {
            entity.ToTable("organizations");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Slug).HasColumnName("slug");

            entity.HasIndex(e => e.Slug, "ix_organizations_slug").IsUnique();
        });

        modelBuilder.Entity<OrganizationMembership>(entity =>
        {
            entity.ToTable("organization_memberships");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.InviteEmail).HasColumnName("invite_email");
            entity.Property(e => e.DisplayName).HasColumnName("display_name");
            entity.Property(e => e.Username).HasColumnName("username");
            entity.Property(e => e.Role).HasColumnName("role");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.RoleAssignedByMembershipId).HasColumnName("role_assigned_by_membership_id");
            entity.Property(e => e.RoleAssignedAt).HasColumnName("role_assigned_at");
            entity.Property(e => e.ClaimedAt).HasColumnName("claimed_at");

            entity.HasIndex(e => new { e.OrganizationId, e.UserId }, "ix_organization_memberships_org_user")
                .IsUnique()
                .HasFilter("user_id IS NOT NULL");

            entity.HasIndex(e => new { e.OrganizationId, e.InviteEmail }, "ix_organization_memberships_org_invite_email")
                .IsUnique()
                .HasFilter("invite_email IS NOT NULL");

            entity.HasOne(e => e.Organization).WithMany()
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_organization_memberships_organization");

            entity.HasOne(e => e.User).WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_organization_memberships_user");

            entity.HasOne(e => e.RoleAssignedByMembership).WithMany()
                .HasForeignKey(e => e.RoleAssignedByMembershipId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_organization_memberships_role_assigned_by");
        });

        modelBuilder.Entity<League>(entity =>
        {
            entity.ToTable("leagues");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Slug).HasColumnName("slug");
            entity.Property(e => e.QueueSize).HasColumnName("queue_size");

            entity.HasIndex(e => new { e.OrganizationId, e.Slug }, "ix_leagues_org_slug").IsUnique();

            entity.HasOne(e => e.Organization).WithMany()
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_leagues_organization");
        });

        modelBuilder.Entity<LeaguePlayer>(entity =>
        {
            entity.ToTable("league_players");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.OrganizationMembershipId).HasColumnName("organization_membership_id");
            entity.Property(e => e.Mmr).HasColumnName("mmr");
            entity.Property(e => e.Mu).HasColumnName("mu");
            entity.Property(e => e.Sigma).HasColumnName("sigma");
            entity.Property(e => e.LegacyPlayerId).HasColumnName("legacy_player_id");

            entity.HasIndex(e => new { e.LeagueId, e.OrganizationMembershipId }, "ix_league_players_league_membership").IsUnique();

            entity.HasOne(e => e.League).WithMany()
                .HasForeignKey(e => e.LeagueId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_league_players_league");

            entity.HasOne(e => e.OrganizationMembership).WithMany()
                .HasForeignKey(e => e.OrganizationMembershipId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_league_players_membership");
        });

        modelBuilder.Entity<V3Season>(entity =>
        {
            entity.ToTable("seasons");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.StartsAt).HasColumnName("starts_at");
            entity.Property(e => e.LegacySeasonId).HasColumnName("legacy_season_id");

            entity.HasIndex(e => e.LeagueId, "ix_seasons_league");

            entity.HasOne(e => e.League).WithMany()
                .HasForeignKey(e => e.LeagueId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_seasons_league");
        });

        modelBuilder.Entity<V3Match>(entity =>
        {
            entity.ToTable("matches");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.SeasonId).HasColumnName("season_id");
            entity.Property(e => e.Source).HasColumnName("source");
            entity.Property(e => e.CreatedByMembershipId).HasColumnName("created_by_membership_id");
            entity.Property(e => e.PlayedAt).HasColumnName("played_at");
            entity.Property(e => e.RecordedAt).HasColumnName("recorded_at");
            entity.Property(e => e.LegacyMatchId).HasColumnName("legacy_match_id");

            entity.HasIndex(e => new { e.LeagueId, e.SeasonId }, "ix_matches_league_season");

            entity.HasOne(e => e.League).WithMany()
                .HasForeignKey(e => e.LeagueId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_matches_league");

            entity.HasOne(e => e.Season).WithMany()
                .HasForeignKey(e => e.SeasonId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_matches_season");

            entity.HasOne(e => e.CreatedByMembership).WithMany()
                .HasForeignKey(e => e.CreatedByMembershipId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_matches_created_by");
        });

        modelBuilder.Entity<MatchTeam>(entity =>
        {
            entity.ToTable("match_teams");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.MatchId).HasColumnName("match_id");
            entity.Property(e => e.Index).HasColumnName("index");
            entity.Property(e => e.Score).HasColumnName("score");
            entity.Property(e => e.IsWinner).HasColumnName("is_winner");

            entity.HasIndex(e => e.MatchId, "ix_match_teams_match");

            entity.HasOne(e => e.Match).WithMany(m => m.Teams)
                .HasForeignKey(e => e.MatchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_match_teams_match");
        });

        modelBuilder.Entity<MatchTeamPlayer>(entity =>
        {
            entity.ToTable("match_team_players");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.MatchTeamId).HasColumnName("match_team_id");
            entity.Property(e => e.LeaguePlayerId).HasColumnName("league_player_id");
            entity.Property(e => e.Index).HasColumnName("index");

            entity.HasOne(e => e.MatchTeam).WithMany(t => t.Players)
                .HasForeignKey(e => e.MatchTeamId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_match_team_players_team");

            entity.HasOne(e => e.LeaguePlayer).WithMany()
                .HasForeignKey(e => e.LeaguePlayerId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_match_team_players_player");
        });

        modelBuilder.Entity<V3PendingMatch>(entity =>
        {
            entity.ToTable("pending_matches");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
        });

        modelBuilder.Entity<PendingMatchTeam>(entity =>
        {
            entity.ToTable("pending_match_teams");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.PendingMatchId).HasColumnName("pending_match_id");
            entity.Property(e => e.Index).HasColumnName("index");

            entity.HasOne(e => e.PendingMatch).WithMany(pm => pm.Teams)
                .HasForeignKey(e => e.PendingMatchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_pending_match_teams_pending_match");
        });

        modelBuilder.Entity<PendingMatchTeamPlayer>(entity =>
        {
            entity.ToTable("pending_match_team_players");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.PendingMatchTeamId).HasColumnName("pending_match_team_id");
            entity.Property(e => e.LeaguePlayerId).HasColumnName("league_player_id");
            entity.Property(e => e.Index).HasColumnName("index");

            entity.HasOne(e => e.PendingMatchTeam).WithMany(t => t.Players)
                .HasForeignKey(e => e.PendingMatchTeamId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_pending_match_team_players_team");

            entity.HasOne(e => e.LeaguePlayer).WithMany()
                .HasForeignKey(e => e.LeaguePlayerId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_pending_match_team_players_player");
        });

        modelBuilder.Entity<PendingMatchAcceptance>(entity =>
        {
            entity.ToTable("pending_match_acceptances");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.PendingMatchId).HasColumnName("pending_match_id");
            entity.Property(e => e.LeaguePlayerId).HasColumnName("league_player_id");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.AcceptedAt).HasColumnName("accepted_at");

            entity.HasOne(e => e.PendingMatch).WithMany(pm => pm.Acceptances)
                .HasForeignKey(e => e.PendingMatchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_pending_match_acceptances_pending_match");

            entity.HasOne(e => e.LeaguePlayer).WithMany()
                .HasForeignKey(e => e.LeaguePlayerId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_pending_match_acceptances_player");
        });

        modelBuilder.Entity<V3ActiveMatch>(entity =>
        {
            entity.ToTable("active_matches");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.PendingMatchId).HasColumnName("pending_match_id");
            entity.Property(e => e.StartedAt).HasColumnName("started_at");

            entity.HasOne(e => e.PendingMatch).WithMany()
                .HasForeignKey(e => e.PendingMatchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_active_matches_pending_match");
        });

        modelBuilder.Entity<QueueEntry>(entity =>
        {
            entity.ToTable("queue_entries");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.LeaguePlayerId).HasColumnName("league_player_id");
            entity.Property(e => e.JoinedAt).HasColumnName("joined_at");

            entity.HasIndex(e => new { e.LeagueId, e.LeaguePlayerId }, "ix_queue_entries_league_player").IsUnique();

            entity.HasOne(e => e.League).WithMany()
                .HasForeignKey(e => e.LeagueId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_queue_entries_league");

            entity.HasOne(e => e.LeaguePlayer).WithMany()
                .HasForeignKey(e => e.LeaguePlayerId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_queue_entries_player");
        });

        modelBuilder.Entity<RatingHistory>(entity =>
        {
            entity.ToTable("rating_histories");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeaguePlayerId).HasColumnName("league_player_id");
            entity.Property(e => e.MatchId).HasColumnName("match_id");
            entity.Property(e => e.Mmr).HasColumnName("mmr");
            entity.Property(e => e.Mu).HasColumnName("mu");
            entity.Property(e => e.Sigma).HasColumnName("sigma");
            entity.Property(e => e.Delta).HasColumnName("delta");

            entity.HasIndex(e => new { e.LeaguePlayerId, e.MatchId }, "ix_rating_histories_player_match");

            entity.HasOne(e => e.LeaguePlayer).WithMany()
                .HasForeignKey(e => e.LeaguePlayerId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_rating_histories_player");

            entity.HasOne(e => e.Match).WithMany()
                .HasForeignKey(e => e.MatchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_rating_histories_match");
        });

        modelBuilder.Entity<V3PersonalAccessToken>(entity =>
        {
            entity.ToTable("personal_access_tokens");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.Scope).HasColumnName("scope");
            entity.Property(e => e.TokenHash).HasColumnName("token_hash");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.LastUsedAt).HasColumnName("last_used_at");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.LegacyPatId).HasColumnName("legacy_pat_id");

            entity.HasIndex(e => e.TokenHash, "ix_personal_access_tokens_token_hash");

            entity.HasOne(e => e.User).WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_personal_access_tokens_user");

            entity.HasOne(e => e.Organization).WithMany()
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_personal_access_tokens_organization");

            entity.HasOne(e => e.League).WithMany()
                .HasForeignKey(e => e.LeagueId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_personal_access_tokens_league");
        });

        modelBuilder.Entity<OrganizationInviteLink>(entity =>
        {
            entity.ToTable("organization_invite_links");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.Code).HasColumnName("code").HasMaxLength(6);
            entity.Property(e => e.CreatedByMembershipId).HasColumnName("created_by_membership_id");
            entity.Property(e => e.MaxUses).HasColumnName("max_uses");
            entity.Property(e => e.UseCount).HasColumnName("use_count");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");

            entity.HasIndex(e => e.Code, "ix_organization_invite_links_code").IsUnique();

            entity.HasOne(e => e.Organization).WithMany()
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_organization_invite_links_organization");

            entity.HasOne(e => e.CreatedByMembership).WithMany()
                .HasForeignKey(e => e.CreatedByMembershipId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_organization_invite_links_created_by");
        });

        modelBuilder.Entity<V3MatchFlag>(entity =>
        {
            entity.ToTable("match_flags");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.MatchId).HasColumnName("match_id");
            entity.Property(e => e.FlaggedByMembershipId).HasColumnName("flagged_by_membership_id");
            entity.Property(e => e.Reason).HasColumnName("reason");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.ResolutionNote).HasColumnName("resolution_note");
            entity.Property(e => e.ResolvedByMembershipId).HasColumnName("resolved_by_membership_id");
            entity.Property(e => e.ResolvedAt).HasColumnName("resolved_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => new { e.LeagueId, e.MatchId }, "ix_match_flags_league_match");

            entity.HasIndex(e => new { e.MatchId, e.FlaggedByMembershipId }, "ix_match_flags_match_flagged_by_open")
                .IsUnique()
                .HasFilter("status = 0");

            entity.HasOne(e => e.Match).WithMany()
                .HasForeignKey(e => e.MatchId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_match_flags_match");

            entity.HasOne(e => e.FlaggedByMembership).WithMany()
                .HasForeignKey(e => e.FlaggedByMembershipId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_match_flags_flagged_by");

            entity.HasOne(e => e.ResolvedByMembership).WithMany()
                .HasForeignKey(e => e.ResolvedByMembershipId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_match_flags_resolved_by");
        });
    }
}
