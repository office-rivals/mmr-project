using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Data;

public partial class ApiDbContext : DbContext
{
    public ApiDbContext()
    {
    }

    public ApiDbContext(DbContextOptions<ApiDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Match> Matches { get; set; }

    public virtual DbSet<MmrCalculation> MmrCalculations { get; set; }

    public virtual DbSet<PlayerHistory> PlayerHistories { get; set; }

    public virtual DbSet<Season> Seasons { get; set; }

    public virtual DbSet<Team> Teams { get; set; }

    public virtual DbSet<User> Users { get; set; }
    
    public virtual DbSet<QueuedPlayer> QueuedPlayers { get; set; }
    
    public virtual DbSet<PendingMatch> PendingMatches { get; set; }

//     protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
// #warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
//         => optionsBuilder.UseNpgsql("Host=localhost;Database=mmr_project;Username=postgres;Password=this_is_a_hard_password1337");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Match>(entity =>
        {
            entity.HasQueryFilter(e => e.DeletedAt == null);
            entity.HasKey(e => e.Id).HasName("matches_pkey");

            entity.ToTable("matches");

            entity.HasIndex(e => e.DeletedAt, "idx_matches_deleted_at");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.SeasonId).HasColumnName("season_id");
            entity.Property(e => e.TeamOneId).HasColumnName("team_one_id");
            entity.Property(e => e.TeamTwoId).HasColumnName("team_two_id");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(d => d.Season).WithMany(p => p.Matches)
                .HasForeignKey(d => d.SeasonId)
                .HasConstraintName("fk_matches_season");

            entity.HasOne(d => d.TeamOne).WithMany(p => p.MatchTeamOnes)
                .HasForeignKey(d => d.TeamOneId)
                .HasConstraintName("fk_matches_team_one");

            entity.HasOne(d => d.TeamTwo).WithMany(p => p.MatchTeamTwos)
                .HasForeignKey(d => d.TeamTwoId)
                .HasConstraintName("fk_matches_team_two");
        });

        modelBuilder.Entity<MmrCalculation>(entity =>
        {
            entity.HasQueryFilter(e => e.DeletedAt == null);
            entity.HasKey(e => e.Id).HasName("mmr_calculations_pkey");

            entity.ToTable("mmr_calculations");

            entity.HasIndex(e => e.DeletedAt, "idx_mmr_calculations_deleted_at");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.MatchId).HasColumnName("match_id");
            entity.Property(e => e.TeamOnePlayerOneMmrDelta).HasColumnName("team_one_player_one_mmr_delta");
            entity.Property(e => e.TeamOnePlayerTwoMmrDelta).HasColumnName("team_one_player_two_mmr_delta");
            entity.Property(e => e.TeamTwoPlayerOneMmrDelta).HasColumnName("team_two_player_one_mmr_delta");
            entity.Property(e => e.TeamTwoPlayerTwoMmrDelta).HasColumnName("team_two_player_two_mmr_delta");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasOne(d => d.Match).WithMany(p => p.MmrCalculations)
                .HasForeignKey(d => d.MatchId)
                .HasConstraintName("fk_matches_mmr_calculations");
        });

        modelBuilder.Entity<PlayerHistory>(entity =>
        {
            entity.HasQueryFilter(e => e.DeletedAt == null);
            entity.HasKey(e => e.Id).HasName("player_histories_pkey");

            entity.ToTable("player_histories");

            entity.HasIndex(e => e.DeletedAt, "idx_player_histories_deleted_at");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.MatchId).HasColumnName("match_id");
            entity.Property(e => e.Mmr).HasColumnName("mmr");
            entity.Property(e => e.Mu).HasColumnName("mu");
            entity.Property(e => e.Sigma).HasColumnName("sigma");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Match).WithMany(p => p.PlayerHistories)
                .HasForeignKey(d => d.MatchId)
                .HasConstraintName("fk_player_histories_match");

            entity.HasOne(d => d.User).WithMany(p => p.PlayerHistories)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("fk_player_histories_user");
        });

        modelBuilder.Entity<Season>(entity =>
        {
            entity.HasQueryFilter(e => e.DeletedAt == null);
            entity.HasKey(e => e.Id).HasName("seasons_pkey");

            entity.ToTable("seasons");

            entity.HasIndex(e => e.DeletedAt, "idx_seasons_deleted_at");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<Team>(entity =>
        {
            entity.HasQueryFilter(e => e.DeletedAt == null);
            entity.HasKey(e => e.Id).HasName("teams_pkey");

            entity.ToTable("teams");

            entity.HasIndex(e => e.DeletedAt, "idx_teams_deleted_at");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.Score).HasColumnName("score");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.UserOneId).HasColumnName("user_one_id");
            entity.Property(e => e.UserTwoId).HasColumnName("user_two_id");
            entity.Property(e => e.Winner).HasColumnName("winner");

            entity.HasOne(d => d.UserOne).WithMany(p => p.TeamUserOnes)
                .HasForeignKey(d => d.UserOneId)
                .HasConstraintName("fk_teams_user_one");

            entity.HasOne(d => d.UserTwo).WithMany(p => p.TeamUserTwos)
                .HasForeignKey(d => d.UserTwoId)
                .HasConstraintName("fk_teams_user_two");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasQueryFilter(e => e.DeletedAt == null);
            entity.HasKey(e => e.Id).HasName("users_pkey");

            entity.ToTable("users");

            entity.HasIndex(e => e.DeletedAt, "idx_users_deleted_at");

            entity.HasIndex(e => e.IdentityUserId, "uni_users_identity_user_id").IsUnique();

            entity.HasIndex(e => e.Name, "uni_users_name").IsUnique();

            entity.HasIndex(e => e.Id, "users_id_key").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.DisplayName).HasColumnName("display_name");
            entity.Property(e => e.IdentityUserId).HasColumnName("identity_user_id");
            entity.Property(e => e.Mmr).HasColumnName("mmr");
            entity.Property(e => e.Mu).HasColumnName("mu");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Sigma).HasColumnName("sigma");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });
    }
}
