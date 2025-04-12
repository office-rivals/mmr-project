using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Controllers;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services;
using Moq;

namespace MMRProject.Api.Tests;

public class MatchMakingControllerTests
{
    private readonly Mock<IMatchMakingService> _mockService;
    private readonly MatchMakingController _controller;

    public MatchMakingControllerTests()
    {
        _mockService = new Mock<IMatchMakingService>();
        _controller = new MatchMakingController(_mockService.Object);
    }

    [Fact]
    public async Task GenerateTeams_WithFourChipIds_ReturnsOkWithTeams()
    {
        // Arrange
        var request = new GenerateTeamsRequest
        {
            ChipIds = new List<string> { "chip1", "chip2", "chip3", "chip4" }
        };

        var expectedResponse = "1,1,0,0";

        _mockService
            .Setup(s => s.GenerateTeamsAsync(request.ChipIds))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await _controller.GenerateTeams(request);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var teamAssignments = Assert.IsType<string>(okResult.Value);
        Assert.Equal(expectedResponse, teamAssignments);
        _mockService.Verify(s => s.GenerateTeamsAsync(request.ChipIds), Times.Once);
    }

    [Theory]
    [InlineData("chip1", "chip2", "chip3")]
    [InlineData("chip1", "chip2", "chip3", "chip4", "chip5")]
    public async Task GenerateTeams_WithInvalidNumberOfChipIds_ReturnsBadRequest(
        params string[] chipIds
    )
    {
        // Arrange
        var request = new GenerateTeamsRequest { ChipIds = chipIds.ToList() };

        // Act
        var result = await _controller.GenerateTeams(request);

        // Assert
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.NotNull(badRequestResult.Value);
        Assert.Contains("4 chip IDs", badRequestResult.Value.ToString()!);
        _mockService.Verify(s => s.GenerateTeamsAsync(It.IsAny<List<string>>()), Times.Never);
    }
}
