using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Auth;
using MMRProject.Api.Data;
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

builder.Services.AddUserContextResolver();

builder.Services.AddScoped<IMatchesService, MatchesService>();
builder.Services.AddScoped<ISeasonService, SeasonService>();
builder.Services.AddScoped<IStatisticsService, StatisticsService>();
builder.Services.AddScoped<IUserService, UserService>();

builder.Services.AddHttpClient<IMMRCalculationApiClient, MMRCalculationApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["MMRCalculationAPI:BaseUrl"]!);
    client.DefaultRequestHeaders.Add("X-API-KEY", builder.Configuration["MMRCalculationAPI:ApiKey"]);
});

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

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