using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace MMRProject.Api.Auth;

public static class BuilderExtensions
{
    public static WebApplicationBuilder AddAuth(this WebApplicationBuilder builder)
    {
        var supabaseSignatureKey = GetSupabaseSecurityKey(builder.Configuration);
        // var validIssuer =
        //     builder.Configuration.GetValue<string>("Supabase:Issuer")!; // TODO: Move all this to a configuration class

        builder.Services.AddAuthentication()
            .AddJwtBearer(o =>
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
            });

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