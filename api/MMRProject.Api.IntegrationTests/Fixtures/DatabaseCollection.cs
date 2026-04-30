using Xunit;

namespace MMRProject.Api.IntegrationTests.Fixtures;

[CollectionDefinition("Database")]
public class DatabaseCollection : ICollectionFixture<PostgresFixture>;
