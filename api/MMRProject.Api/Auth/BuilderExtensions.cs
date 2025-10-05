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
        var supabaseSignatureKey = GetSupabaseSecurityKey(builder.Configuration);
        // var validIssuer =
        //     builder.Configuration.GetValue<string>("Supabase:Issuer")!; // TODO: Move all this to a configuration class

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
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    ValidateIssuer = false,
                    ValidateAudience = true,
                    IssuerSigningKey = supabaseSignatureKey,
                    ValidAudiences = ["authenticated"],
                    // ValidIssuer = validIssuer
                };
            })
            .AddScheme<PersonalAccessTokenAuthenticationOptions, PersonalAccessTokenAuthenticationHandler>(
                PatScheme, options => { });

        return builder;
    }

    private static SymmetricSecurityKey GetSupabaseSecurityKey(IConfiguration configuration)
    {
        var keyInConfiguration = configuration.GetValue<string>("Supabase:SignatureKey");
        if (string.IsNullOrEmpty(keyInConfiguration))
        {
            // TODO: Better exception
            throw new Exception("Supabase Signature Key not found in configuration");
        }

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyInConfiguration));
    }
}