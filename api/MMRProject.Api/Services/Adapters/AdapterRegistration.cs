namespace MMRProject.Api.Services.Adapters;

public static class AdapterRegistration
{
    public static IServiceCollection AddServicesWithAdapterSupport(
        this IServiceCollection services, IConfiguration configuration)
    {
        if (configuration.GetValue<bool>("Features:UseV3Adapters"))
        {
            // Register adapter infrastructure
            services.AddScoped<ILegacyContextResolver, LegacyContextResolver>();
            services.AddScoped<ILegacyIdResolver, LegacyIdResolver>();

            // Register adapter implementations of legacy interfaces
            services.AddScoped<IMatchesService, MatchesServiceAdapter>();
            services.AddScoped<IUserService, UserServiceAdapter>();
            services.AddScoped<ISeasonService, SeasonServiceAdapter>();
            services.AddScoped<IStatisticsService, StatisticsServiceAdapter>();
            services.AddScoped<IMatchMakingService, MatchMakingServiceAdapter>();
            services.AddScoped<IPersonalAccessTokenService, PersonalAccessTokenServiceAdapter>();
            services.AddScoped<IRoleService, RoleServiceAdapter>();
            services.AddScoped<IMatchFlagService, MatchFlagServiceAdapter>();
        }
        else
        {
            // Register original implementations
            services.AddScoped<IMatchesService, MatchesService>();
            services.AddScoped<IMatchMakingService, MatchMakingService>();
            services.AddScoped<ISeasonService, SeasonService>();
            services.AddScoped<IStatisticsService, StatisticsService>();
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<IPersonalAccessTokenService, PersonalAccessTokenService>();
            services.AddScoped<IRoleService, RoleService>();
            services.AddScoped<IMatchFlagService, MatchFlagService>();
        }

        return services;
    }
}
