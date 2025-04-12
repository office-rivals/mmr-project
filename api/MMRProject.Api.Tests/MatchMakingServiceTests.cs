using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;
using MMRProject.Api.Exceptions;
using MMRProject.Api.MMRCalculationApi;
using MMRProject.Api.MMRCalculationApi.Models;
using MMRProject.Api.Services;
using MMRProject.Api.UserContext;
using Moq;

namespace MMRProject.Api.Tests;

public class MatchMakingServiceTests : IDisposable
{
    private readonly ApiDbContext _dbContext;
    private readonly Mock<IMMRCalculationApiClient> _mockMmrClient;
    private readonly Mock<ILogger<MatchMakingService>> _mockLogger;
    private readonly Mock<IUserContextResolver> _mockUserContext;
    private readonly Mock<IMatchesService> _mockMatchesService;
    private readonly Mock<ISeasonService> _mockSeasonService;
    private readonly MatchMakingService _service;

    public MatchMakingServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApiDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _dbContext = new ApiDbContext(options);
        _mockMmrClient = new Mock<IMMRCalculationApiClient>();
        _mockLogger = new Mock<ILogger<MatchMakingService>>();
        _mockUserContext = new Mock<IUserContextResolver>();
        _mockMatchesService = new Mock<IMatchesService>();
        _mockSeasonService = new Mock<ISeasonService>();

        _service = new MatchMakingService(
            _mockLogger.Object,
            _mockUserContext.Object,
            _dbContext,
            _mockMatchesService.Object,
            _mockSeasonService.Object,
            _mockMmrClient.Object
        );

        SeedDatabase();
    }

    private void SeedDatabase()
    {
        var users = new List<User>
        {
            new()
            {
                Id = 1,
                ChipId = "chip1",
                Mu = 25.0m,
                Sigma = 8.33m
            },
            new()
            {
                Id = 2,
                ChipId = "chip2",
                Mu = 25.0m,
                Sigma = 8.33m
            },
            new()
            {
                Id = 3,
                ChipId = "chip3",
                Mu = 25.0m,
                Sigma = 8.33m
            },
            new()
            {
                Id = 4,
                ChipId = "chip4",
                Mu = 25.0m,
                Sigma = 8.33m
            }
        };

        _dbContext.Users.AddRange(users);
        _dbContext.SaveChanges();
    }

    [Fact]
    public async Task GenerateTeams_WithValidChipIds_ReturnsTeams()
    {
        // Arrange
        var chipIds = new List<string> { "chip1", "chip2", "chip3", "chip4" };
        var mmrResponse = new GenerateTeamsResponse
        {
            Team1 = new TeamV2Response
            {
                Players = new List<PlayerV2Response>
                {
                    new()
                    {
                        Id = 1,
                        Mu = 25.0m,
                        Sigma = 8.33m
                    },
                    new()
                    {
                        Id = 2,
                        Mu = 25.0m,
                        Sigma = 8.33m
                    }
                }
            },
            Team2 = new TeamV2Response
            {
                Players = new List<PlayerV2Response>
                {
                    new()
                    {
                        Id = 3,
                        Mu = 25.0m,
                        Sigma = 8.33m
                    },
                    new()
                    {
                        Id = 4,
                        Mu = 25.0m,
                        Sigma = 8.33m
                    }
                }
            }
        };

        _mockMmrClient
            .Setup(c =>
                c.GenerateTeamsAsync(It.IsAny<MMRCalculationApi.Models.GenerateTeamsRequest>())
            )
            .ReturnsAsync(mmrResponse);

        // Act
        var result = await _service.GenerateTeamsAsync(chipIds);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Team1.ChipIds.Count);
        Assert.Equal(2, result.Team2.ChipIds.Count);
        Assert.Contains("chip1", result.Team1.ChipIds);
        Assert.Contains("chip2", result.Team1.ChipIds);
        Assert.Contains("chip3", result.Team2.ChipIds);
        Assert.Contains("chip4", result.Team2.ChipIds);
    }

    [Fact]
    public async Task GenerateTeams_WithMissingPlayer_ThrowsException()
    {
        // Arrange
        var chipIds = new List<string> { "chip1", "chip2", "chip3", "nonexistent" };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidArgumentException>(
            () => _service.GenerateTeamsAsync(chipIds)
        );
        Assert.Contains("Could not find all 4 players", exception.Message);
    }

    [Fact]
    public async Task GenerateTeams_WithDuplicateChipIds_ThrowsException()
    {
        // Arrange
        var chipIds = new List<string> { "chip1", "chip1", "chip2", "chip3" };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidArgumentException>(
            () => _service.GenerateTeamsAsync(chipIds)
        );
        Assert.Contains("Could not find all 4 players", exception.Message);
    }

    public void Dispose()
    {
        _dbContext.Database.EnsureDeleted();
        _dbContext.Dispose();
    }
}
