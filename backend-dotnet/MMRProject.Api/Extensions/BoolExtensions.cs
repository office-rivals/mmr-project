namespace MMRProject.Api.Extensions;

public static class BoolExtensions
{
    public static bool? NullIfFalse(this bool b)
    {
        return b ? b : null;
    }
}