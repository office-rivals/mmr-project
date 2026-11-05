using System.Security.Cryptography;

namespace MMRProject.Api.Services.V3;

/// <summary>
/// The Play tab's Random teams draw, ported from the beta's client-side shuffle:
/// a Fisher–Yates permutation with no rating input. The first <c>teamSize</c>
/// shuffled entries form team 0, the next <c>teamSize</c> form team 1.
/// </summary>
public static class GameInviteShuffle
{
    public static IReadOnlyList<T> FisherYates<T>(IReadOnlyList<T> items, Func<int, int> randomBelow)
    {
        var shuffled = items.ToList();
        for (var i = shuffled.Count - 1; i > 0; i--)
        {
            var j = randomBelow(i + 1);
            (shuffled[i], shuffled[j]) = (shuffled[j], shuffled[i]);
        }

        return shuffled;
    }

    public static IReadOnlyList<T> FisherYates<T>(IReadOnlyList<T> items) =>
        FisherYates(items, upperExclusive => RandomNumberGenerator.GetInt32(upperExclusive));
}
