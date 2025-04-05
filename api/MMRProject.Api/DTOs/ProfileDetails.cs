namespace MMRProject.Api.DTOs;

public record ProfileDetails
{
    public long? UserId { get; set; }

    public int[] ColorCode { get; set; } = [];
}
