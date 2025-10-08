using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace MMRProject.Api.Auth;

public static class BuilderExtensions
{
    private const string JwtBearerScheme = JwtBearerDefaults.AuthenticationScheme;
    private const string PatScheme = "PersonalAccessToken";

    public static WebApplicationBuilder AddAuth(this WebApplicationBuilder builder)
    {
        builder.Services.AddAuthentication(options =>
            {
                options.DefaultScheme = "MultiAuth";
                options.DefaultChallengeScheme = "MultiAuth";
            })
            .AddPolicyScheme("MultiAuth", "Multi-Authentication Scheme", options =>
            {
                options.ForwardDefaultSelector = context =>
                {
                    var authHeader = context.Request.Headers.Authorization.ToString();
                    if (authHeader.StartsWith("Bearer pat_", StringComparison.OrdinalIgnoreCase))
                    {
                        return PatScheme;
                    }

                    return JwtBearerScheme;
                };
            })
            .AddJwtBearer(JwtBearerScheme, o =>
            {
                var issuer = builder.Configuration.GetValue<string>("Authorization:Issuer");
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = false,
                    ValidIssuer = issuer,
                };
                o.Authority = issuer;
            })
            .AddScheme<PersonalAccessTokenAuthenticationOptions, PersonalAccessTokenAuthenticationHandler>(
                PatScheme, options => { });

        return builder;
    }
}