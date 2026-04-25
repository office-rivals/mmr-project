using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using MMRProject.Api.Auth;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.BackgroundServices;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.MMRCalculationApi;
using MMRProject.Api.Services.V3;
using MMRProject.Api.UserContext;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddDbContextPool<ApiDbContext>(opt =>
    opt.UseNpgsql(
        builder.Configuration.GetConnectionString("ApiDbContext"),
        o => o.SetPostgresVersion(13, 0)
    )
);

builder.AddAuth();

builder.Services.AddMemoryCache();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(V3AuthorizationPolicies.RequireOrgOwner, policy =>
        policy.Requirements.Add(new OrganizationRoleRequirement(OrganizationRole.Owner)));
    options.AddPolicy(V3AuthorizationPolicies.RequireOrgModerator, policy =>
        policy.Requirements.Add(new OrganizationRoleRequirement(OrganizationRole.Moderator)));
    options.AddPolicy(V3AuthorizationPolicies.RequireOrgMember, policy =>
        policy.Requirements.Add(new OrganizationRoleRequirement(OrganizationRole.Member)));
    options.AddPolicy(V3AuthorizationPolicies.RequireLeagueAccess, policy =>
        policy.Requirements.Add(new LeagueAccessRequirement()));
    options.AddPolicy(V3AuthorizationPolicies.RequirePatWrite, policy =>
        policy.Requirements.Add(new PatScopeRequirement(PatScopes.Write)));
    options.AddPolicy(V3AuthorizationPolicies.DenyPatAuthentication, policy =>
        policy.Requirements.Add(new DenyPatAuthenticationRequirement()));
});

builder.Services.AddSingleton<IAuthorizationHandler, OrganizationRoleAuthorizationHandler>();
builder.Services.AddSingleton<IAuthorizationHandler, LeagueAccessAuthorizationHandler>();
builder.Services.AddSingleton<IAuthorizationHandler, PatAuthorizationHandler>();
builder.Services.AddSingleton<IAuthorizationHandler, DenyPatAuthenticationHandler>();
builder.Services.AddHttpContextAccessor();

builder.Services.AddUserContextResolver();

builder.Services.AddScoped<IV3UserService, V3UserService>();
builder.Services.AddScoped<ISessionService, SessionService>();
builder.Services.AddScoped<IOrganizationService, OrganizationService>();
builder.Services.AddScoped<ILeagueService, LeagueService>();
builder.Services.AddScoped<ILeaguePlayerService, LeaguePlayerService>();
builder.Services.AddScoped<IV3SeasonService, V3SeasonService>();
builder.Services.AddScoped<IV3MatchesService, V3MatchesService>();
builder.Services.AddScoped<IV3LeaderboardService, V3LeaderboardService>();
builder.Services.AddScoped<IV3RatingHistoryService, V3RatingHistoryService>();
builder.Services.AddScoped<IV3MatchMakingService, V3MatchMakingService>();
builder.Services.AddScoped<IV3PendingMatchCoordinator, V3PendingMatchCoordinator>();
builder.Services.AddScoped<IV3PersonalAccessTokenService, V3PersonalAccessTokenService>();
builder.Services.AddScoped<IV3MatchFlagService, V3MatchFlagService>();
builder.Services.AddScoped<IInviteLinkService, InviteLinkService>();

builder.Services.AddHostedService<V3MatchMakingBackgroundService>();

// External APIs
builder.Services.AddHttpClient<IMMRCalculationApiClient, MMRCalculationApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["MMRCalculationAPI:BaseUrl"]!);
    client.DefaultRequestHeaders.Add("X-API-KEY", builder.Configuration["MMRCalculationAPI:ApiKey"]);
});

builder.Services
    .AddControllers()
    .AddJsonOptions(options => { options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()); });
builder.Services.AddExceptionHandler<HttpExceptionHandler>();
builder.Services.AddProblemDetails();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v3", new OpenApiInfo { Title = "MMR Project API v3", Version = "v3" });
    options.CustomOperationIds(api =>
    {
        if (api.ActionDescriptor is ControllerActionDescriptor actionDescriptor)
        {
            return $"{actionDescriptor.ControllerName}_{actionDescriptor.ActionName}";
        }

        return null;
    });
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v3/swagger.json", "MMR Project API v3");
});

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers().RequireAuthorization();

using (var scope = app.Services.CreateScope())
{
    var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    if (configuration.GetValue<bool>("Migration:Enabled"))
    {
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        db.Database.Migrate();
    }
}

app.Run();

public partial class Program;
