namespace MMRProject.Api.Extensions;

public static class IEnumerableExtensions
{
    public static IEnumerable<T> WhereNotNull<T>(this IEnumerable<T?> sequence)
        where T : class
    {
        return (IEnumerable<T>)sequence.Where(e => e != null);
    }

    public static IEnumerable<T> WhereNotNull<T>(this IEnumerable<T?> sequence)
        where T : struct
    {
        return sequence.Where(e => e != null).Select(e => e!.Value);
    }
}