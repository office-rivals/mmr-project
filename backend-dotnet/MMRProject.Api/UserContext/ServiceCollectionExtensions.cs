namespace MMRProject.Api.UserContext;

public static class ServiceCollectionExtensions
{
    public static void AddUserContextResolver(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<IUserContextResolver, UserContextResolver>();
    }
}