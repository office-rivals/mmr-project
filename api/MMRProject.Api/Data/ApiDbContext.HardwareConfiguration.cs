using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Data;

public partial class ApiDbContext
{
    private static void ConfigureHardwareEntities(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<FoosballTable>(entity =>
        {
            entity.ToTable("foosball_tables");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(100);
            entity.Property(e => e.ShortCode).HasColumnName("short_code").HasMaxLength(ShortCode.CustomMaxLength);
            entity.Property(e => e.LeagueId).HasColumnName("league_id");
            entity.Property(e => e.EndLabelA).HasColumnName("end_label_a").HasMaxLength(12);
            entity.Property(e => e.EndLabelB).HasColumnName("end_label_b").HasMaxLength(12);
            entity.Property(e => e.SoundVolume).HasColumnName("sound_volume");
            entity.Property(e => e.StateVersion).HasColumnName("state_version");

            entity.HasIndex(e => e.OrganizationId, "ix_foosball_tables_organization");
            entity.HasIndex(e => e.ShortCode, "ix_foosball_tables_short_code").IsUnique();

            entity.HasOne<Organization>().WithMany()
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_foosball_tables_organization");

            entity.HasOne(e => e.League).WithMany()
                .HasForeignKey(e => e.LeagueId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_foosball_tables_league");
        });

        modelBuilder.Entity<Device>(entity =>
        {
            entity.ToTable("devices");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.HardwareId).HasColumnName("hardware_id").HasMaxLength(15);
            entity.Property(e => e.SecretHash).HasColumnName("secret_hash");
            entity.Property(e => e.Claimed).HasColumnName("claimed");
            entity.Property(e => e.ClaimedAt).HasColumnName("claimed_at");
            entity.Property(e => e.Role).HasColumnName("role");
            entity.Property(e => e.TableId).HasColumnName("table_id");
            entity.Property(e => e.End).HasColumnName("end");
            entity.Property(e => e.ConfigVersion).HasColumnName("config_version");
            entity.Property(e => e.LastSeenAt).HasColumnName("last_seen_at");
            entity.Property(e => e.AwakeSince).HasColumnName("awake_since");
            entity.Property(e => e.BatteryMv).HasColumnName("battery_mv");
            entity.Property(e => e.LowBatt).HasColumnName("low_batt");
            entity.Property(e => e.FirmwareVersion).HasColumnName("firmware_version").HasMaxLength(64);
            entity.Property(e => e.LastStatusAt).HasColumnName("last_status_at");
            entity.Property(e => e.LastStatus).HasColumnName("last_status").HasColumnType("jsonb");
            entity.Property(e => e.BeamConfig).HasColumnName("beam_config").HasColumnType("jsonb");

            entity.HasIndex(e => e.HardwareId, "ix_devices_hardware_id").IsUnique();
            entity.HasIndex(e => e.OrganizationId, "ix_devices_organization");

            // One goal counter per goal. Role 0 = Goal.
            entity.HasIndex(e => new { e.TableId, e.End }, "ix_devices_table_goal_end")
                .IsUnique()
                .HasFilter("role = 0 AND table_id IS NOT NULL");

            entity.HasOne<Organization>().WithMany()
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_devices_organization");

            entity.HasOne(e => e.Table).WithMany()
                .HasForeignKey(e => e.TableId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_devices_table");
        });

        modelBuilder.Entity<TableMatch>(entity =>
        {
            entity.ToTable("table_matches");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.TableId).HasColumnName("table_id");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.ShortCode).HasColumnName("short_code").HasMaxLength(ShortCode.Length);
            entity.Property(e => e.StartedAt).HasColumnName("started_at");
            entity.Property(e => e.EndedAt).HasColumnName("ended_at");
            entity.Property(e => e.LastActivityAt).HasColumnName("last_activity_at");
            entity.Property(e => e.ScoreA).HasColumnName("score_a");
            entity.Property(e => e.ScoreB).HasColumnName("score_b");
            entity.Property(e => e.ActiveMatchId).HasColumnName("active_match_id");
            entity.Property(e => e.ActiveMatchTeamIndexAtEndA).HasColumnName("active_match_team_index_at_end_a");
            entity.Property(e => e.OwnsActiveMatch).HasColumnName("owns_active_match");
            entity.Property(e => e.TeamsMode).HasColumnName("teams_mode");
            entity.Property(e => e.AutoSubmitAt).HasColumnName("auto_submit_at");
            entity.Property(e => e.EndedByMembershipId).HasColumnName("ended_by_membership_id");
            entity.Property(e => e.MatchId).HasColumnName("match_id");

            entity.HasIndex(e => new { e.TableId, e.StartedAt }, "ix_table_matches_table_started");
            entity.HasIndex(e => new { e.OrganizationId, e.Status }, "ix_table_matches_org_status");
            entity.HasIndex(e => e.ShortCode, "ix_table_matches_short_code").IsUnique();
            entity.HasIndex(e => e.AutoSubmitAt, "ix_table_matches_auto_submit").HasFilter("auto_submit_at IS NOT NULL");

            entity.HasOne(e => e.Table).WithMany()
                .HasForeignKey(e => e.TableId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_table_matches_table");

            // Active matches are deleted when submitted or cancelled elsewhere; the table match
            // then just loses its roster.
            entity.HasOne(e => e.ActiveMatch).WithMany()
                .HasForeignKey(e => e.ActiveMatchId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_table_matches_active_match");

            entity.HasOne<V3Match>().WithMany()
                .HasForeignKey(e => e.MatchId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_table_matches_match");
        });

        modelBuilder.Entity<TableGoal>(entity =>
        {
            entity.ToTable("table_goals");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.EventId).HasColumnName("event_id").HasMaxLength(64);
            entity.Property(e => e.DeviceId).HasColumnName("device_id");
            entity.Property(e => e.TableMatchId).HasColumnName("table_match_id");
            entity.Property(e => e.TableId).HasColumnName("table_id");
            entity.Property(e => e.OrphanReason).HasColumnName("orphan_reason");
            entity.Property(e => e.ScoringEnd).HasColumnName("scoring_end");
            entity.Property(e => e.Seq).HasColumnName("seq");
            entity.Property(e => e.OccurredAt).HasColumnName("occurred_at");
            entity.Property(e => e.ReceivedAt).HasColumnName("received_at");
            entity.Property(e => e.BatteryMv).HasColumnName("battery_mv");
            entity.Property(e => e.UndoneAt).HasColumnName("undone_at");
            entity.Property(e => e.UndoEventId).HasColumnName("undo_event_id");
            entity.Property(e => e.ScorerLeaguePlayerId).HasColumnName("scorer_league_player_id");

            entity.HasIndex(e => e.EventId, "ix_table_goals_event_id").IsUnique();
            entity.HasIndex(e => e.UndoEventId, "ix_table_goals_undo_event_id").IsUnique().HasFilter("undo_event_id IS NOT NULL");
            entity.HasIndex(e => e.TableMatchId, "ix_table_goals_table_match");
            entity.HasIndex(e => new { e.OrganizationId, e.ReceivedAt }, "ix_table_goals_org_orphans")
                .HasFilter("orphan_reason IS NOT NULL");

            entity.HasOne<FoosballTable>().WithMany()
                .HasForeignKey(e => e.TableId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_table_goals_table");

            entity.HasOne<Device>().WithMany()
                .HasForeignKey(e => e.DeviceId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_table_goals_device");

            entity.HasOne(e => e.TableMatch).WithMany(m => m.Goals)
                .HasForeignKey(e => e.TableMatchId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_table_goals_table_match");

            entity.HasOne<LeaguePlayer>().WithMany()
                .HasForeignKey(e => e.ScorerLeaguePlayerId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_table_goals_scorer");
        });

        modelBuilder.Entity<PlayerCard>(entity =>
        {
            entity.ToTable("player_cards");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.OrganizationMembershipId).HasColumnName("organization_membership_id");
            entity.Property(e => e.UidHmac).HasColumnName("uid_hmac");
            entity.Property(e => e.LinkedByMembershipId).HasColumnName("linked_by_membership_id");

            entity.HasIndex(e => new { e.OrganizationId, e.UidHmac }, "ix_player_cards_org_uid").IsUnique();
            entity.HasIndex(e => e.OrganizationMembershipId, "ix_player_cards_membership");

            entity.HasOne<Organization>().WithMany()
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_player_cards_organization");

            entity.HasOne(e => e.OrganizationMembership).WithMany()
                .HasForeignKey(e => e.OrganizationMembershipId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_player_cards_membership");

            entity.HasOne(e => e.LinkedByMembership).WithMany()
                .HasForeignKey(e => e.LinkedByMembershipId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_player_cards_linked_by");
        });

        modelBuilder.Entity<TableRosterEntry>(entity =>
        {
            entity.ToTable("table_roster_entries");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.TableId).HasColumnName("table_id");
            entity.Property(e => e.LeaguePlayerId).HasColumnName("league_player_id");
            entity.Property(e => e.Color).HasColumnName("color");

            entity.HasIndex(e => new { e.TableId, e.LeaguePlayerId }, "ix_table_roster_entries_table_player").IsUnique();
            entity.HasIndex(e => e.LeaguePlayerId, "ix_table_roster_entries_player");

            entity.HasOne<FoosballTable>().WithMany()
                .HasForeignKey(e => e.TableId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_table_roster_entries_table");

            entity.HasOne(e => e.LeaguePlayer).WithMany()
                .HasForeignKey(e => e.LeaguePlayerId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_table_roster_entries_league_player");
        });

        modelBuilder.Entity<DeviceWake>(entity =>
        {
            entity.ToTable("device_wakes");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.DeviceId).HasColumnName("device_id");
            entity.Property(e => e.TableId).HasColumnName("table_id");
            entity.Property(e => e.WokeAt).HasColumnName("woke_at");
            entity.Property(e => e.IdleFrom).HasColumnName("idle_from");

            entity.HasIndex(e => new { e.TableId, e.WokeAt }, "ix_device_wakes_table_woke_at");

            entity.HasOne<FoosballTable>().WithMany()
                .HasForeignKey(e => e.TableId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_device_wakes_table");
        });

        modelBuilder.Entity<CardLinkRequest>(entity =>
        {
            entity.ToTable("card_link_requests");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.OrganizationId).HasColumnName("organization_id");
            entity.Property(e => e.TableId).HasColumnName("table_id");
            entity.Property(e => e.UidHmac).HasColumnName("uid_hmac");
            entity.Property(e => e.ShortCode).HasColumnName("short_code").HasMaxLength(ShortCode.Length);
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");

            entity.HasIndex(e => e.ShortCode, "ix_card_link_requests_short_code").IsUnique();
            // One pending unknown card per table: a new scan replaces it.
            entity.HasIndex(e => e.TableId, "ix_card_link_requests_table").IsUnique();
            entity.HasIndex(e => e.ExpiresAt, "ix_card_link_requests_expires");

            entity.HasOne<FoosballTable>().WithMany()
                .HasForeignKey(e => e.TableId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_card_link_requests_table");
        });
    }
}
