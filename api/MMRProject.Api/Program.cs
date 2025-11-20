using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Auth;
using MMRProject.Api.Authorization;
using MMRProject.Api.BackgroundServices;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.Exceptions;
using MMRProject.Api.MMRCalculationApi;
using MMRProject.Api.Services;
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
    options.AddPolicy(AuthorizationPolicies.RequireOwnerRole, policy =>
        policy.Requirements.Add(new PlayerRoleRequirement(PlayerRole.Owner)));

    options.AddPolicy(AuthorizationPolicies.RequireModeratorRole, policy =>
        policy.Requirements.Add(new PlayerRoleRequirement(PlayerRole.Moderator)));

    options.AddPolicy(AuthorizationPolicies.RequireUserRole, policy =>
        policy.Requirements.Add(new PlayerRoleRequirement(PlayerRole.User)));
});

builder.Services.AddSingleton<IAuthorizationHandler, PlayerRoleAuthorizationHandler>();

builder.Services.AddScoped<IClaimsTransformation, RoleClaimsTransformation>();

builder.Services.AddUserContextResolver();

builder.Services.AddScoped<IMatchesService, MatchesService>();
builder.Services.AddScoped<IMatchMakingService, MatchMakingService>();
builder.Services.AddScoped<ISeasonService, SeasonService>();
builder.Services.AddScoped<IStatisticsService, StatisticsService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IPersonalAccessTokenService, PersonalAccessTokenService>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IMatchFlagService, MatchFlagService>();

// Background services
builder.Services.AddHostedService<MatchMakingBackgroundService>();

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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

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