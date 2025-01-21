﻿// <auto-generated />
using System;
using MMRProject.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MMRProject.Api.Data.Migrations
{
    [DbContext(typeof(ApiDbContext))]
    partial class ApiDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "8.0.8")
                .HasAnnotation("Relational:MaxIdentifierLength", 63);

            NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

            modelBuilder.Entity("MMRProject.Api.Data.Entities.ActiveMatch", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<DateTimeOffset>("CreatedAt")
                        .HasColumnType("timestamp with time zone");

                    b.Property<long>("TeamOneUserOneId")
                        .HasColumnType("bigint");

                    b.Property<long>("TeamOneUserTwoId")
                        .HasColumnType("bigint");

                    b.Property<long>("TeamTwoUserOneId")
                        .HasColumnType("bigint");

                    b.Property<long>("TeamTwoUserTwoId")
                        .HasColumnType("bigint");

                    b.HasKey("Id");

                    b.HasIndex("TeamOneUserOneId");

                    b.HasIndex("TeamOneUserTwoId");

                    b.HasIndex("TeamTwoUserOneId");

                    b.HasIndex("TeamTwoUserTwoId");

                    b.ToTable("ActiveMatches");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.Match", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .HasColumnName("id");

                    NpgsqlPropertyBuilderExtensions.UseIdentityByDefaultColumn(b.Property<long>("Id"));

                    b.Property<DateTime?>("CreatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("created_at");

                    b.Property<DateTime?>("DeletedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("deleted_at");

                    b.Property<long?>("SeasonId")
                        .HasColumnType("bigint")
                        .HasColumnName("season_id");

                    b.Property<long?>("TeamOneId")
                        .HasColumnType("bigint")
                        .HasColumnName("team_one_id");

                    b.Property<long?>("TeamTwoId")
                        .HasColumnType("bigint")
                        .HasColumnName("team_two_id");

                    b.Property<DateTime?>("UpdatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("updated_at");

                    b.HasKey("Id")
                        .HasName("matches_pkey");

                    b.HasIndex("SeasonId");

                    b.HasIndex("TeamOneId");

                    b.HasIndex("TeamTwoId");

                    b.HasIndex(new[] { "DeletedAt" }, "idx_matches_deleted_at");

                    b.ToTable("matches", (string)null);
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.MmrCalculation", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .HasColumnName("id");

                    NpgsqlPropertyBuilderExtensions.UseIdentityByDefaultColumn(b.Property<long>("Id"));

                    b.Property<DateTime?>("CreatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("created_at");

                    b.Property<DateTime?>("DeletedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("deleted_at");

                    b.Property<long?>("MatchId")
                        .HasColumnType("bigint")
                        .HasColumnName("match_id");

                    b.Property<long?>("TeamOnePlayerOneMmrDelta")
                        .HasColumnType("bigint")
                        .HasColumnName("team_one_player_one_mmr_delta");

                    b.Property<long?>("TeamOnePlayerTwoMmrDelta")
                        .HasColumnType("bigint")
                        .HasColumnName("team_one_player_two_mmr_delta");

                    b.Property<long?>("TeamTwoPlayerOneMmrDelta")
                        .HasColumnType("bigint")
                        .HasColumnName("team_two_player_one_mmr_delta");

                    b.Property<long?>("TeamTwoPlayerTwoMmrDelta")
                        .HasColumnType("bigint")
                        .HasColumnName("team_two_player_two_mmr_delta");

                    b.Property<DateTime?>("UpdatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("updated_at");

                    b.HasKey("Id")
                        .HasName("mmr_calculations_pkey");

                    b.HasIndex("MatchId");

                    b.HasIndex(new[] { "DeletedAt" }, "idx_mmr_calculations_deleted_at");

                    b.ToTable("mmr_calculations", (string)null);
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.PendingMatch", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<Guid?>("ActiveMatchId")
                        .HasColumnType("uuid");

                    b.Property<DateTimeOffset>("CreatedAt")
                        .HasColumnType("timestamp with time zone");

                    b.Property<DateTimeOffset>("ExpiresAt")
                        .HasColumnType("timestamp with time zone");

                    b.Property<int>("Status")
                        .HasColumnType("integer");

                    b.Property<DateTimeOffset>("UpdatedAt")
                        .HasColumnType("timestamp with time zone");

                    b.HasKey("Id");

                    b.HasIndex("ActiveMatchId")
                        .IsUnique();

                    b.ToTable("PendingMatches");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.PlayerHistory", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .HasColumnName("id");

                    NpgsqlPropertyBuilderExtensions.UseIdentityByDefaultColumn(b.Property<long>("Id"));

                    b.Property<DateTime?>("CreatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("created_at");

                    b.Property<DateTime?>("DeletedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("deleted_at");

                    b.Property<long?>("MatchId")
                        .HasColumnType("bigint")
                        .HasColumnName("match_id");

                    b.Property<long?>("Mmr")
                        .HasColumnType("bigint")
                        .HasColumnName("mmr");

                    b.Property<decimal?>("Mu")
                        .HasColumnType("numeric")
                        .HasColumnName("mu");

                    b.Property<decimal?>("Sigma")
                        .HasColumnType("numeric")
                        .HasColumnName("sigma");

                    b.Property<DateTime?>("UpdatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("updated_at");

                    b.Property<long?>("UserId")
                        .HasColumnType("bigint")
                        .HasColumnName("user_id");

                    b.HasKey("Id")
                        .HasName("player_histories_pkey");

                    b.HasIndex("MatchId");

                    b.HasIndex("UserId");

                    b.HasIndex(new[] { "DeletedAt" }, "idx_player_histories_deleted_at");

                    b.ToTable("player_histories", (string)null);
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.QueuedPlayer", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<DateTimeOffset>("CreatedAt")
                        .HasColumnType("timestamp with time zone");

                    b.Property<Guid?>("LastAcceptedMatchId")
                        .HasColumnType("uuid");

                    b.Property<Guid?>("PendingMatchId")
                        .HasColumnType("uuid");

                    b.Property<long>("UserId")
                        .HasColumnType("bigint");

                    b.HasKey("Id");

                    b.HasIndex("PendingMatchId");

                    b.HasIndex("UserId");

                    b.ToTable("QueuedPlayers");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.Season", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .HasColumnName("id");

                    NpgsqlPropertyBuilderExtensions.UseIdentityByDefaultColumn(b.Property<long>("Id"));

                    b.Property<DateTime?>("CreatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("created_at");

                    b.Property<DateTime?>("DeletedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("deleted_at");

                    b.Property<DateTime?>("UpdatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("updated_at");

                    b.HasKey("Id")
                        .HasName("seasons_pkey");

                    b.HasIndex(new[] { "DeletedAt" }, "idx_seasons_deleted_at");

                    b.ToTable("seasons", (string)null);
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.Team", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .HasColumnName("id");

                    NpgsqlPropertyBuilderExtensions.UseIdentityByDefaultColumn(b.Property<long>("Id"));

                    b.Property<DateTime?>("CreatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("created_at");

                    b.Property<DateTime?>("DeletedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("deleted_at");

                    b.Property<long?>("Score")
                        .HasColumnType("bigint")
                        .HasColumnName("score");

                    b.Property<DateTime?>("UpdatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("updated_at");

                    b.Property<long?>("UserOneId")
                        .HasColumnType("bigint")
                        .HasColumnName("user_one_id");

                    b.Property<long?>("UserTwoId")
                        .HasColumnType("bigint")
                        .HasColumnName("user_two_id");

                    b.Property<bool?>("Winner")
                        .HasColumnType("boolean")
                        .HasColumnName("winner");

                    b.HasKey("Id")
                        .HasName("teams_pkey");

                    b.HasIndex("UserOneId");

                    b.HasIndex("UserTwoId");

                    b.HasIndex(new[] { "DeletedAt" }, "idx_teams_deleted_at");

                    b.ToTable("teams", (string)null);
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.User", b =>
                {
                    b.Property<long>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("bigint")
                        .HasColumnName("id");

                    NpgsqlPropertyBuilderExtensions.UseIdentityByDefaultColumn(b.Property<long>("Id"));

                    b.Property<DateTime?>("CreatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("created_at");

                    b.Property<DateTime?>("DeletedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("deleted_at");

                    b.Property<string>("DisplayName")
                        .HasColumnType("text")
                        .HasColumnName("display_name");

                    b.Property<string>("IdentityUserId")
                        .HasColumnType("text")
                        .HasColumnName("identity_user_id");

                    b.Property<long?>("Mmr")
                        .HasColumnType("bigint")
                        .HasColumnName("mmr");

                    b.Property<decimal?>("Mu")
                        .HasColumnType("numeric")
                        .HasColumnName("mu");

                    b.Property<string>("Name")
                        .HasColumnType("text")
                        .HasColumnName("name");

                    b.Property<decimal?>("Sigma")
                        .HasColumnType("numeric")
                        .HasColumnName("sigma");

                    b.Property<DateTime?>("UpdatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("updated_at");

                    b.HasKey("Id")
                        .HasName("users_pkey");

                    b.HasIndex(new[] { "DeletedAt" }, "idx_users_deleted_at");

                    b.HasIndex(new[] { "IdentityUserId" }, "uni_users_identity_user_id")
                        .IsUnique();

                    b.HasIndex(new[] { "Name" }, "uni_users_name")
                        .IsUnique();

                    b.HasIndex(new[] { "Id" }, "users_id_key")
                        .IsUnique();

                    b.ToTable("users", (string)null);
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.ActiveMatch", b =>
                {
                    b.HasOne("MMRProject.Api.Data.Entities.User", "TeamOneUserOne")
                        .WithMany()
                        .HasForeignKey("TeamOneUserOneId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("MMRProject.Api.Data.Entities.User", "TeamOneUserTwo")
                        .WithMany()
                        .HasForeignKey("TeamOneUserTwoId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("MMRProject.Api.Data.Entities.User", "TeamTwoUserOne")
                        .WithMany()
                        .HasForeignKey("TeamTwoUserOneId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("MMRProject.Api.Data.Entities.User", "TeamTwoUserTwo")
                        .WithMany()
                        .HasForeignKey("TeamTwoUserTwoId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("TeamOneUserOne");

                    b.Navigation("TeamOneUserTwo");

                    b.Navigation("TeamTwoUserOne");

                    b.Navigation("TeamTwoUserTwo");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.Match", b =>
                {
                    b.HasOne("MMRProject.Api.Data.Entities.Season", "Season")
                        .WithMany("Matches")
                        .HasForeignKey("SeasonId")
                        .HasConstraintName("fk_matches_season");

                    b.HasOne("MMRProject.Api.Data.Entities.Team", "TeamOne")
                        .WithMany("MatchTeamOnes")
                        .HasForeignKey("TeamOneId")
                        .HasConstraintName("fk_matches_team_one");

                    b.HasOne("MMRProject.Api.Data.Entities.Team", "TeamTwo")
                        .WithMany("MatchTeamTwos")
                        .HasForeignKey("TeamTwoId")
                        .HasConstraintName("fk_matches_team_two");

                    b.Navigation("Season");

                    b.Navigation("TeamOne");

                    b.Navigation("TeamTwo");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.MmrCalculation", b =>
                {
                    b.HasOne("MMRProject.Api.Data.Entities.Match", "Match")
                        .WithMany("MmrCalculations")
                        .HasForeignKey("MatchId")
                        .HasConstraintName("fk_matches_mmr_calculations");

                    b.Navigation("Match");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.PendingMatch", b =>
                {
                    b.HasOne("MMRProject.Api.Data.Entities.ActiveMatch", "ActiveMatch")
                        .WithOne("PendingMatch")
                        .HasForeignKey("MMRProject.Api.Data.Entities.PendingMatch", "ActiveMatchId");

                    b.Navigation("ActiveMatch");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.PlayerHistory", b =>
                {
                    b.HasOne("MMRProject.Api.Data.Entities.Match", "Match")
                        .WithMany("PlayerHistories")
                        .HasForeignKey("MatchId")
                        .HasConstraintName("fk_player_histories_match");

                    b.HasOne("MMRProject.Api.Data.Entities.User", "User")
                        .WithMany("PlayerHistories")
                        .HasForeignKey("UserId")
                        .HasConstraintName("fk_player_histories_user");

                    b.Navigation("Match");

                    b.Navigation("User");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.QueuedPlayer", b =>
                {
                    b.HasOne("MMRProject.Api.Data.Entities.PendingMatch", "PendingMatch")
                        .WithMany("QueuedPlayers")
                        .HasForeignKey("PendingMatchId");

                    b.HasOne("MMRProject.Api.Data.Entities.User", "User")
                        .WithMany()
                        .HasForeignKey("UserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("PendingMatch");

                    b.Navigation("User");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.Team", b =>
                {
                    b.HasOne("MMRProject.Api.Data.Entities.User", "UserOne")
                        .WithMany("TeamUserOnes")
                        .HasForeignKey("UserOneId")
                        .HasConstraintName("fk_teams_user_one");

                    b.HasOne("MMRProject.Api.Data.Entities.User", "UserTwo")
                        .WithMany("TeamUserTwos")
                        .HasForeignKey("UserTwoId")
                        .HasConstraintName("fk_teams_user_two");

                    b.Navigation("UserOne");

                    b.Navigation("UserTwo");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.ActiveMatch", b =>
                {
                    b.Navigation("PendingMatch");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.Match", b =>
                {
                    b.Navigation("MmrCalculations");

                    b.Navigation("PlayerHistories");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.PendingMatch", b =>
                {
                    b.Navigation("QueuedPlayers");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.Season", b =>
                {
                    b.Navigation("Matches");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.Team", b =>
                {
                    b.Navigation("MatchTeamOnes");

                    b.Navigation("MatchTeamTwos");
                });

            modelBuilder.Entity("MMRProject.Api.Data.Entities.User", b =>
                {
                    b.Navigation("PlayerHistories");

                    b.Navigation("TeamUserOnes");

                    b.Navigation("TeamUserTwos");
                });
#pragma warning restore 612, 618
        }
    }
}
