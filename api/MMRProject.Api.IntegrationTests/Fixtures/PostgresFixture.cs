using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace MMRProject.Api.IntegrationTests.Fixtures;

public class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:16-alpine")
        .Build();

    public string GetConnectionString() => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        await WaitUntilAcceptingTcpConnectionsAsync();
    }

    // The postgres image's entrypoint runs a temporary init server on the Unix
    // socket only, so the container can report ready while TCP connections are
    // still refused. Whichever test runs first would otherwise fail to connect.
    private async Task WaitUntilAcceptingTcpConnectionsAsync()
    {
        var deadline = DateTime.UtcNow.AddSeconds(30);
        while (true)
        {
            try
            {
                await using var connection = new NpgsqlConnection(GetConnectionString());
                await connection.OpenAsync();
                return;
            }
            catch (NpgsqlException) when (DateTime.UtcNow < deadline)
            {
                await Task.Delay(100);
            }
        }
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}
