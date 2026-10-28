using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace MMRProject.Api.Data;

/// <summary>Unguessable short-link codes: 10 Crockford base32 characters (50 bits).</summary>
public static partial class ShortCode
{
    public const int Length = 10;

    /// <summary>A table's code can instead be readable, set by an admin: lowercase, 3–32 of [a-z0-9-].</summary>
    public const int CustomMaxLength = 32;

    [GeneratedRegex("^[a-z0-9-]{3,32}$")]
    public static partial Regex CustomPattern();
    private const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    public static string New() => RandomNumberGenerator.GetString(Alphabet, Length);

    /// <summary>Uppercases and maps the look-alikes Crockford allows (I/L → 1, O → 0).</summary>
    public static string Normalize(string code) =>
        code.Trim().ToUpperInvariant().Replace('I', '1').Replace('L', '1').Replace('O', '0');
}
