public static class ColorCodeHelper
{
    /// <summary>
    /// Converts a base-4 color code to an integer ID.
    /// The color code is expected to be an array of 4 integers, each in the range [0, 3].
    /// The resulting ID will be in the range [1, 256].
    /// </summary>
    /// <param name="colorCode">The base-4 color code.</param>
    /// <returns>The integer ID.</returns>
    /// <exception cref="ArgumentException">Thrown if the color code is not valid.</exception>
    public static int ConvertBase4ToIntId(int[] colorCode)
    {
        if (colorCode.Length != 4)
        {
            throw new ArgumentException("Color code must have 4 elements.");
        }

        int result = 0;
        int power = 1;

        for (int i = colorCode.Length - 1; i >= 0; i--)
        {
            if (colorCode[i] < 0 || colorCode[i] > 3)
            {
                throw new ArgumentException("Color code values must be in the range [0, 3].");
            }
            result += colorCode[i] * power;
            power *= 4;
        }

        return result + 1; // Add 1 to the result
    }

    /// <summary>
    /// Converts an integer ID to a base-4 color code.
    /// The ID is expected to be in the range [1, 256].
    /// The resulting color code will be an array of 4 integers, each in the range [0, 3]
    /// representing the base-4 representation of the ID.
    /// </summary>
    /// <param name="id">The integer ID.</param>
    /// <returns>The base-4 color code.</returns>
    /// <exception cref="ArgumentOutOfRangeException">Thrown if the ID is not valid.</exception>
    public static int[] ConvertIntIdToBase4(int id)
    {
        if (id < 1 || id > 256)
        {
            throw new ArgumentOutOfRangeException(nameof(id), "ID must be in the range [1, 256].");
        }

        int base4Value = id - 1; // Subtract 1 to reverse the +1 from ConvertBase4ToIntId
        int[] colorCode = new int[4];

        for (int i = 3; i >= 0; i--)
        {
            colorCode[i] = base4Value % 4;
            base4Value /= 4;
        }

        return colorCode;
    }
}
